"""
AC Control Management API

This module provides a comprehensive FastAPI application for managing an AC control system.
It includes functionalities for:
- Customer authentication and profile management.
- Zone and device management within a customer's account.
- Real-time device status updates and history tracking via MQTT and WebSockets.
- Secure API endpoints with JWT-based authentication.

The application is built using FastAPI, SQLAlchemy for asynchronous database operations,
Paho-MQTT for MQTT communication, and Pydantic for data validation.
"""

import asyncio
import json
import logging
import os
import re
import ssl
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
from urllib.parse import urlparse, parse_qs, urlencode

import bcrypt
import jwt
import paho.mqtt.client as mqtt
from dotenv import load_dotenv
from fastapi import (FastAPI, HTTPException, Depends, Header, WebSocket,
                   WebSocketDisconnect, Query)
from fastapi.exceptions import WebSocketException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict
from sqlalchemy import (Column, String, DateTime, ForeignKey, Text, JSON,
                        update, delete)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import (create_async_engine, AsyncSession,
                                    async_sessionmaker)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.future import select
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from starlette import status
from starlette.websockets import WebSocketState

# --- Environment and Configuration Setup ---
load_dotenv()

# Load essential environment variables
DATABASE_URL = os.getenv("DATABASE_URL")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
DEVICE_SECRET_KEY = os.getenv("DEVICE_SECRET_KEY")
MQTT_BROKER = os.getenv("MQTT_BROKER")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))  # Default MQTT port
MQTT_USERNAME = os.getenv("MQTT_USERNAME")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")

# Validate that all required environment variables are set
required_vars = {
    "DATABASE_URL": DATABASE_URL,
    "JWT_SECRET_KEY": JWT_SECRET_KEY,
    "DEVICE_SECRET_KEY": DEVICE_SECRET_KEY,
    "MQTT_BROKER": MQTT_BROKER,
    "MQTT_USERNAME": MQTT_USERNAME,
    "MQTT_PASSWORD": MQTT_PASSWORD,
}
missing_vars = [key for key, value in required_vars.items() if not value]
if missing_vars:
    raise ValueError(
        f"Missing required environment variables: {', '.join(missing_vars)}"
    )

# --- Logging Configuration ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('app.log', mode='a')
    ]
)
logger = logging.getLogger(__name__)


# --- Database Connection ---
def parse_database_url(url: str) -> tuple[str, Dict[str, Any]]:
    """
    Parses the database URL to separate connection arguments like 'statement_cache_size'.
    This is necessary because create_async_engine expects these as separate arguments.
    """
    try:
        parsed = urlparse(url)
        query = parse_qs(parsed.query)
        connect_args = {}
        if 'statement_cache_size' in query:
            try:
                connect_args['statement_cache_size'] = int(
                    query['statement_cache_size'][0])
                del query['statement_cache_size']
            except (ValueError, IndexError):
                raise ValueError("statement_cache_size must be an integer")
        new_query = urlencode(query, doseq=True)
        new_url = parsed._replace(query=new_query).geturl()
        return new_url, connect_args
    except Exception as e:
        logger.error(f"Error parsing DATABASE_URL: {e}")
        raise ValueError(f"Invalid DATABASE_URL format: {e}")


try:
    new_database_url, connect_args = parse_database_url(DATABASE_URL)
    engine = create_async_engine(
        new_database_url,
        connect_args=connect_args,
        echo=False,  # Set to True for debugging SQL queries
        pool_size=20,
        max_overflow=10,
        pool_timeout=30
    )
    async_session = async_sessionmaker(engine,
                                       class_=AsyncSession,
                                       expire_on_commit=False)
except Exception as e:
    logger.critical(f"Failed to initialize database engine: {e}")
    raise

# --- SQLAlchemy ORM Models ---
Base = declarative_base()


class Customer(Base):
    __tablename__ = "customers"
    customer_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    username = Column(String(64), unique=True, nullable=False, index=True)
    company_name = Column(String(255))
    company_address = Column(Text)
    phone_no = Column(String(20))
    country = Column(String(100))
    state = Column(String(100))
    city = Column(String(100))
    settings = Column(JSON, nullable=False, default=lambda: {})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True),
                        server_default=func.now(),
                        onupdate=func.now())
    zones = relationship("Zone",
                         back_populates="customer",
                         cascade="all, delete-orphan")
    devices = relationship("Device",
                           back_populates="customer",
                           cascade="all, delete-orphan")


class Zone(Base):
    __tablename__ = "zones"
    zone_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True),
                         ForeignKey("customers.customer_id", ondelete="CASCADE"),
                         nullable=False)
    zone_location_name = Column(String(64), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True),
                        server_default=func.now(),
                        onupdate=func.now())
    customer = relationship("Customer", back_populates="zones")
    devices = relationship("Device",
                           back_populates="zone",
                           cascade="all, delete-orphan")


class Device(Base):
    __tablename__ = "devices"
    device_id = Column(String(17), primary_key=True)
    customer_id = Column(UUID(as_uuid=True),
                         ForeignKey("customers.customer_id", ondelete="CASCADE"),
                         nullable=False)
    zone_id = Column(UUID(as_uuid=True),
                     ForeignKey("zones.zone_id", ondelete="CASCADE"),
                     nullable=False)
    ac_brand_name = Column(String(32), nullable=False)
    ac_brand_protocol = Column(String(32), nullable=False)
    firmware_version = Column(String(20), nullable=False)
    last_seen = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True),
                        server_default=func.now(),
                        onupdate=func.now())
    customer = relationship("Customer", back_populates="devices")
    zone = relationship("Zone", back_populates="devices")
    status_history = relationship("StatusHistory",
                                  back_populates="device",
                                  cascade="all, delete-orphan")


class StatusHistory(Base):
    __tablename__ = "status_history"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(String(17),
                       ForeignKey("devices.device_id", ondelete="CASCADE"),
                       nullable=False)
    status_type = Column(String(50), nullable=False)
    payload = Column(JSON, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    device = relationship("Device", back_populates="status_history")


# --- Pydantic Models for API Data Validation ---
class CustomerRegister(BaseModel):
    """Model for customer registration."""
    email: EmailStr
    password: str = Field(
        ...,
        min_length=8,
        max_length=32,
        description="Password must be 8-32 characters and contain an uppercase letter, a lowercase letter, a digit, and a special character."
    )
    username: str = Field(
        ...,
        min_length=3,
        max_length=32,
        description="Username must be 3-32 characters and contain only alphanumeric characters and underscores."
    )
    company_name: str = Field(..., min_length=1)
    company_address: str = Field(..., min_length=1)
    phone_no: str = Field(...,
                          min_length=1,
                          max_length=20,
                          description="Phone number in E.164 format.")
    country: str = Field(..., min_length=1, max_length=100)
    state: str = Field(..., min_length=1, max_length=100)
    city: str = Field(..., min_length=1, max_length=100)

    @field_validator('password')
    def validate_password(cls, v: str) -> str:
        if not re.match(r'^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$',
                        v):
            raise ValueError(
                'Password must contain uppercase, lowercase, digit, and special character'
            )
        return v

    @field_validator('username')
    def validate_username(cls, v: str) -> str:
        if not re.match(r'^[a-zA-Z0-9_]+$', v):
            raise ValueError(
                'Username can only contain alphanumeric characters and underscores'
            )
        return v

    @field_validator('phone_no')
    def validate_phone_no(cls, v: str) -> str:
        if not re.match(r'^\+?[1-9]\d{1,14}$', v):
            raise ValueError('Invalid phone number format')
        return v


class CustomerLogin(BaseModel):
    email: EmailStr
    password: str


class CustomerUpdate(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = Field(
        None,
        min_length=3,
        max_length=32,
        description="Username must be 3-32 characters and contain only alphanumeric characters and underscores."
    )
    company_name: Optional[str] = Field(None, min_length=1)
    company_address: Optional[str] = Field(None, min_length=1)
    phone_no: Optional[str] = Field(
        None,
        min_length=1,
        max_length=20,
        description="Phone number in E.164 format.")
    country: Optional[str] = Field(None, min_length=1, max_length=100)
    state: Optional[str] = Field(None, min_length=1, max_length=100)
    city: Optional[str] = Field(None, min_length=1, max_length=100)

    @field_validator('username')
    def validate_username(cls, v: Optional[str]) -> Optional[str]:
        if v and not re.match(r'^[a-zA-Z0-9_]+$', v):
            raise ValueError(
                'Username can only contain alphanumeric characters and underscores'
            )
        return v

    @field_validator('phone_no')
    def validate_phone_no(cls, v: Optional[str]) -> Optional[str]:
        if v and not re.match(r'^\+?[1-9]\d{1,14}$', v):
            raise ValueError('Invalid phone number format')
        return v


class ChangePassword(BaseModel):
    current_password: str
    new_password: str = Field(
        ...,
        min_length=8,
        max_length=32,
        description="New password must be 8-32 characters and contain an uppercase letter, a lowercase letter, a digit, and a special character."
    )

    @field_validator('new_password')
    def validate_password(cls, v: str) -> str:
        if not re.match(r'^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$',
                        v):
            raise ValueError(
                'New password must contain uppercase, lowercase, digit, and special character'
            )
        return v


class SettingsUpdate(BaseModel):
    notifications_enabled: Optional[bool] = None
    api_key: Optional[str] = Field(None, min_length=16, max_length=64)
    dashboard_theme: Optional[str] = Field(None, pattern=r'^(light|dark)$')


class CustomerResponse(BaseModel):
    customer_id: uuid.UUID
    email: str
    username: str
    company_name: str
    company_address: str
    phone_no: str
    country: str
    state: str
    city: str
    settings: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        json_encoders={
            uuid.UUID: str,
            datetime: lambda v: v.isoformat()
        })


class ZoneCreate(BaseModel):
    zone_location_name: str = Field(
        ...,
        min_length=1,
        max_length=64,
        description="Name of the zone, e.g., 'Living Room' or 'Office'.")

    @field_validator('zone_location_name')
    def validate_printable_chars(cls, v: str) -> str:
        if not v.isprintable():
            raise ValueError(
                'Zone location name must contain only printable characters')
        return v


class ZoneUpdate(BaseModel):
    zone_location_name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=64,
        description="New name for the zone.")

    @field_validator('zone_location_name')
    def validate_printable_chars(cls, v: Optional[str]) -> Optional[str]:
        if v and not v.isprintable():
            raise ValueError(
                'Zone location name must contain only printable characters')
        return v


class ZoneResponse(BaseModel):
    zone_id: uuid.UUID
    customer_id: uuid.UUID
    zone_location_name: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        json_encoders={
            uuid.UUID: str,
            datetime: lambda v: v.isoformat()
        })


class DeviceCreate(BaseModel):
    device_id: str = Field(
        ...,
        pattern=r'^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$',
        description="Unique MAC address of the device.")
    zone_id: uuid.UUID
    ac_brand_name: str = Field(..., min_length=1, max_length=32)
    ac_brand_protocol: str = Field(..., min_length=1, max_length=32)
    firmware_version: str = Field(
        ...,
        pattern=r'^\d+\.\d+\.\d+$',
        description="Firmware version in semantic versioning format (e.g., '1.0.0')."
    )

    @field_validator('device_id')
    def validate_mac_address(cls, v: str) -> str:
        if not re.match(r'^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$', v):
            raise ValueError('Device ID must be a valid MAC address')
        return v.upper()


class DeviceUpdate(BaseModel):
    zone_id: Optional[uuid.UUID] = None
    ac_brand_name: Optional[str] = Field(None, min_length=1, max_length=32)
    ac_brand_protocol: Optional[str] = Field(None, min_length=1, max_length=32)
    firmware_version: Optional[str] = Field(
        None,
        pattern=r'^\d+\.\d+\.\d+$',
        description="Firmware version in semantic versioning format (e.g., '1.0.0')."
    )
    last_seen: Optional[datetime] = None


class DeviceResponse(BaseModel):
    device_id: str
    customer_id: uuid.UUID
    zone_id: uuid.UUID
    ac_brand_name: str
    ac_brand_protocol: str
    firmware_version: str
    last_seen: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        json_encoders={
            uuid.UUID: str,
            datetime: lambda v: v.isoformat()
        })


class StatusHistoryResponse(BaseModel):
    id: uuid.UUID
    device_id: str
    status_type: str
    payload: Dict[str, Any]
    timestamp: datetime

    model_config = ConfigDict(
        from_attributes=True,
        json_encoders={
            uuid.UUID: str,
            datetime: lambda v: v.isoformat()
        })


class ZoneValidation(BaseModel):
    zone_id: uuid.UUID
    customer_id: uuid.UUID


class DeviceCommand(BaseModel):
    command: str = Field(
        ...,
        pattern=r'^(power|mode|temperature|fanspeed)$',
        description="Command to send to the device.")
    value: str


class OTAUpdate(BaseModel):
    firmware_url: str = Field(...,
                              min_length=1,
                              description="URL to the firmware binary.")
    firmware_version: str = Field(
        ...,
        pattern=r'^\d+\.\d+\.\d+$',
        description="The new firmware version.")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    customer: CustomerResponse


class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    page_size: int


# --- Database Session Dependency ---
async def get_db() -> AsyncSession:
    async with async_session() as session:
        try:
            yield session
        except Exception as e:
            logger.error(f"Database session error: {e}")
            await session.rollback()
            raise
        finally:
            await session.close()


# --- Security and Authentication Utilities ---
def hash_password(password: str) -> str:
    try:
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt)
        return hashed_password.decode('utf-8')
    except Exception as e:
        logger.error(f"Password hashing error: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Internal server error during password processing.")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception as e:
        logger.error(f"Password verification error: {e}")
        return False


def create_jwt_token(customer_id: uuid.UUID) -> str:
    try:
        payload = {
            "customer_id": str(customer_id),
            "exp": datetime.now(timezone.utc) + timedelta(days=30),
            "iat": datetime.now(timezone.utc)
        }
        return jwt.encode(payload, JWT_SECRET_KEY, algorithm="HS256")
    except Exception as e:
        logger.error(f"JWT creation error: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Could not create authentication token.")


def verify_jwt_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
        logger.debug(f"JWT token decoded successfully: {payload}")
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning(f"Expired JWT token received.")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Token has expired")
    except jwt.InvalidSignatureError:
        logger.warning(f"Invalid JWT signature.")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid token signature")
    except jwt.DecodeError:
        logger.warning(f"Malformed JWT token received.")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid token format")


security = HTTPBearer(auto_error=False)


async def get_current_customer(
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
        db: AsyncSession = Depends(get_db)) -> Customer:
    """
    Retrieves the currently authenticated customer using the provided JWT credentials.
    """
    if credentials is None or credentials.credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Not authenticated")
    try:
        payload = verify_jwt_token(credentials.credentials)
        customer_id = payload.get("customer_id")
        if not customer_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Invalid token payload")
        try:
            customer_uuid = uuid.UUID(customer_id)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Invalid customer_id format in token")

        result = await db.execute(
            select(Customer).where(Customer.customer_id == customer_uuid))
        customer = result.scalar_one_or_none()
        if not customer:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Customer not found")
        return customer
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Authentication failed")


async def get_current_customer_or_device_auth(
    db: AsyncSession = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    x_device_secret: Optional[str] = Header(None, alias="X-Device-Secret")
) -> Optional[Customer]:
    """
    Retrieves the current customer or authenticates a device using the DEVICE_SECRET_KEY.
    """
    logger.debug(f"Received X-Device-Secret header: {x_device_secret is not None}")
    try:
        if credentials and credentials.credentials:
            logger.debug("Attempting authentication with JWT credentials.")
            return await get_current_customer(credentials, db)
        if x_device_secret:
            logger.debug("Attempting authentication with X-Device-Secret.")
            if x_device_secret == DEVICE_SECRET_KEY:
                logger.info("Device authentication successful.")
                return None  # Indicates successful device auth
            logger.warning("Device authentication failed: Invalid device secret.")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Invalid device secret")
        logger.warning("Authentication attempt with no credentials.")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Authentication required")
    except HTTPException as e:
        # Re-raise HTTPExceptions to be handled by FastAPI
        raise e
    except Exception as e:
        logger.error(f"Unexpected authentication error: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="An unexpected error occurred during authentication.")


async def get_current_customer_ws(token: str = Query(...),
                                  db: AsyncSession = Depends(get_db)) -> Customer:
    """
    WebSocket-specific authentication to retrieve the current customer.
    """
    try:
        payload = verify_jwt_token(token)
        customer_id = payload.get("customer_id")
        if not customer_id:
            logger.warning("WebSocket auth failed: No customer_id in token.")
            raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION,
                                     reason="Invalid token payload")
        try:
            customer_uuid = uuid.UUID(customer_id)
        except ValueError:
            logger.warning(
                f"WebSocket auth failed: Invalid customer_id format '{customer_id}'."
            )
            raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION,
                                     reason="Invalid customer_id format")

        result = await db.execute(
            select(Customer).where(Customer.customer_id == customer_uuid))
        customer = result.scalar_one_or_none()
        if not customer:
            logger.warning(
                f"WebSocket auth failed: Customer '{customer_id}' not found.")
            raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION,
                                     reason="Customer not found")

        logger.info(
            f"WebSocket authentication successful for customer: {customer_id}")
        return customer
    except WebSocketException as e:
        raise e
    except Exception as e:
        logger.error(f"WebSocket authentication error for token '{token}': {e}")
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION,
                                 reason="Authentication failed")


# --- MQTT Client Setup and Callbacks ---
mqtt_client = mqtt.Client(client_id=f"backend_{uuid.uuid4().hex}",
                          protocol=mqtt.MQTTv5)
app_event_loop = None


def on_connect(client, userdata, flags, rc, properties=None):
    if rc == 0:
        logger.info("Connected to MQTT broker and subscribing to 'node/#'")
        client.subscribe("node/#", qos=1)
    else:
        logger.error(f"MQTT connection failed with code {rc}. Retrying...")


async def store_message(customer_id: str, device_id: str, message_type: str,
                        payload: Dict[str, Any]):
    async with async_session() as session:
        try:
            async with session.begin():
                # Find the device to ensure it exists
                result = await session.execute(
                    select(Device).where(Device.device_id == device_id.upper()))
                device = result.scalar_one_or_none()

                if not device:
                    logger.warning(
                        f"Received MQTT message for unknown device '{device_id}'. Ignoring."
                    )
                    return

                # Update device last_seen or other properties based on message type
                update_values = {"last_seen": datetime.now(timezone.utc)}
                if message_type == "telemetry" and "firmware_version" in payload:
                    update_values["firmware_version"] = payload["firmware_version"]

                await session.execute(
                    update(Device)
                    .where(Device.device_id == device_id.upper())
                    .values(**update_values)
                )

                # Create a new status history record
                status_entry = StatusHistory(device_id=device_id.upper(),
                                             status_type=message_type,
                                             payload=payload)
                session.add(status_entry)

            await session.commit()
            logger.info(
                f"Successfully stored '{message_type}' message for device '{device_id}'."
            )
        except Exception as e:
            logger.error(f"Error storing MQTT message for device '{device_id}': {e}")
            await session.rollback()


def on_message(client, userdata, msg):
    global app_event_loop
    try:
        topic_parts = msg.topic.split('/')
        if len(topic_parts) < 4:
            logger.warning(f"Ignoring invalid MQTT topic format: {msg.topic}")
            return

        customer_id, device_id, message_type = topic_parts[1], topic_parts[
            2], topic_parts[3]

        # Basic validation of topic parts
        try:
            uuid.UUID(customer_id)
        except ValueError:
            logger.warning(f"Invalid customer ID in topic: {customer_id}")
            return
        if not re.match(r'^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$', device_id):
            logger.warning(f"Invalid device ID (MAC address) in topic: {device_id}")
            return
        if message_type not in ["status", "telemetry"]:
            logger.warning(f"Ignoring unsupported message type: {message_type}")
            return

        # Decode and validate payload
        try:
            payload = json.loads(msg.payload.decode('utf-8'))
            if not isinstance(payload, dict):
                raise ValueError("Payload must be a JSON object.")
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"Invalid JSON payload received on topic {msg.topic}: {e}")
            return

        if app_event_loop is None:
            logger.error(
                "Application event loop not initialized; cannot process MQTT message."
            )
            return

        # Schedule the database operation on the main application event loop
        asyncio.run_coroutine_threadsafe(
            store_message(customer_id, device_id, message_type, payload),
            app_event_loop)

    except Exception as e:
        logger.error(f"Unexpected error in on_message callback: {e}")


mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message


# --- FastAPI Application Lifespan ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handles application startup and shutdown events.
    - Creates database tables.
    - Connects to the MQTT broker.
    - Cleans up connections on shutdown.
    """
    logger.info("Application startup sequence initiated.")
    global app_event_loop
    try:
        # Create database tables if they don't exist
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables checked/created successfully.")

        # Configure and connect MQTT client
        mqtt_client.tls_set(tls_version=ssl.PROTOCOL_TLS)
        mqtt_client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
        mqtt_client.reconnect_delay_set(min_delay=1, max_delay=120)
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
        mqtt_client.loop_start()
        logger.info("MQTT client started and connected.")

        app_event_loop = asyncio.get_running_loop()
        yield
    except Exception as e:
        logger.critical(f"A critical error occurred during application startup: {e}")
        raise
    finally:
        logger.info("Application shutdown sequence initiated.")
        mqtt_client.loop_stop()
        mqtt_client.disconnect()
        await engine.dispose()
        logger.info("Resources cleaned up. Shutdown complete.")


# --- FastAPI App Initialization ---
app = FastAPI(
    title="AC Control Management API",
    description="API for managing customers, zones, devices, and their status history.",
    version="1.0.0",
    lifespan=lifespan,
    redoc_url="/redoc",
    docs_url="/docs")

# --- CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to specific domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Root Endpoint ---
@app.get("/", tags=["General"])
async def root():
    """Provides basic information about the API."""
    return {
        "message": "Welcome to the AC Control Management API",
        "version": "1.0.0",
        "documentation": "/docs"
    }


# --- Authentication Endpoints ---
@app.post(
    "/auth/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Authentication"],
    summary="Register a new customer")
async def register_customer(customer_data: CustomerRegister,
                            db: AsyncSession = Depends(get_db)):
    """
    Registers a new customer and returns a JWT token upon successful registration.
    """
    try:
        # Check for existing email or username
        result = await db.execute(
            select(Customer).where((Customer.email == customer_data.email) |
                                   (Customer.username == customer_data.username)))
        if result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                detail="Email or username already registered.")

        # Create new customer
        new_customer = Customer(
            email=customer_data.email,
            password_hash=hash_password(customer_data.password),
            username=customer_data.username,
            company_name=customer_data.company_name,
            company_address=customer_data.company_address,
            phone_no=customer_data.phone_no,
            country=customer_data.country,
            state=customer_data.state,
            city=customer_data.city,
            settings={"notifications_enabled": True, "dashboard_theme": "light"})
        db.add(new_customer)
        await db.commit()
        await db.refresh(new_customer)

        # Generate token and response
        token = create_jwt_token(new_customer.customer_id)
        logger.info(f"New customer registered: {new_customer.email}")
        return TokenResponse(
            access_token=token,
            customer=CustomerResponse.model_validate(new_customer))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during customer registration: {e}")
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="An internal error occurred during registration.")


@app.post("/auth/login",
          response_model=TokenResponse,
          tags=["Authentication"],
          summary="Log in a customer")
async def login_customer(login_data: CustomerLogin,
                         db: AsyncSession = Depends(get_db)):
    """
    Authenticates a customer and returns a JWT token.
    """
    try:
        result = await db.execute(
            select(Customer).where(Customer.email == login_data.email))
        customer = result.scalar_one_or_none()

        if not customer or not verify_password(login_data.password,
                                               customer.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Invalid email or password.")

        token = create_jwt_token(customer.customer_id)
        logger.info(f"Customer logged in: {customer.email}")
        return TokenResponse(access_token=token,
                             customer=CustomerResponse.model_validate(customer))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during customer login: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="An internal error occurred during login.")


# --- Profile Management Endpoints ---
@app.get("/profile",
         response_model=CustomerResponse,
         tags=["Profile"],
         summary="Get current user's profile")
async def get_profile(current_customer: Customer = Depends(get_current_customer)):
    """
    Retrieves the profile of the currently authenticated customer.
    """
    return CustomerResponse.model_validate(current_customer)


@app.put("/profile",
         response_model=CustomerResponse,
         tags=["Profile"],
         summary="Update current user's profile")
async def update_profile(update_data: CustomerUpdate,
                         current_customer: Customer = Depends(get_current_customer),
                         db: AsyncSession = Depends(get_db)):
    """
    Updates the profile of the currently authenticated customer.
    """
    try:
        update_dict = update_data.model_dump(exclude_unset=True)
        if not update_dict:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="No fields provided for update.")

        # Check for email/username conflicts
        if "email" in update_dict:
            result = await db.execute(
                select(Customer).where(
                    (Customer.email == update_data.email) &
                    (Customer.customer_id != current_customer.customer_id)))
            if result.scalar_one_or_none():
                raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                    detail="Email already in use.")
        if "username" in update_dict:
            result = await db.execute(
                select(Customer).where(
                    (Customer.username == update_data.username) &
                    (Customer.customer_id != current_customer.customer_id)))
            if result.scalar_one_or_none():
                raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                    detail="Username already in use.")

        # Apply updates
        for key, value in update_dict.items():
            setattr(current_customer, key, value)
        await db.commit()
        await db.refresh(current_customer)

        logger.info(f"Profile updated for customer: {current_customer.email}")
        return CustomerResponse.model_validate(current_customer)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating profile: {e}")
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="An internal error occurred during profile update.")


@app.post("/profile/change-password",
          tags=["Profile"],
          summary="Change current user's password")
async def change_password(change_data: ChangePassword,
                          current_customer: Customer = Depends(get_current_customer),
                          db: AsyncSession = Depends(get_db)):
    """
    Changes the password for the currently authenticated customer.
    """
    try:
        if not verify_password(change_data.current_password,
                               current_customer.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Current password is incorrect.")

        current_customer.password_hash = hash_password(change_data.new_password)
        await db.commit()

        logger.info(f"Password changed for customer: {current_customer.email}")
        return {"message": "Password updated successfully."}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error changing password: {e}")
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="An internal error occurred during password change.")


@app.delete("/profile",
            status_code=status.HTTP_204_NO_CONTENT,
            tags=["Profile"],
            summary="Delete current user's profile")
async def delete_profile(current_customer: Customer = Depends(get_current_customer),
                         db: AsyncSession = Depends(get_db)):
    """
    Deletes the profile of the currently authenticated customer. This is a permanent action.
    """
    try:
        await db.delete(current_customer)
        await db.commit()
        logger.info(f"Customer profile deleted: {current_customer.email}")
    except Exception as e:
        logger.error(f"Error deleting profile: {e}")
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="An internal error occurred during profile deletion.")


# --- Settings Management Endpoints ---
@app.get("/settings",
         response_model=Dict[str, Any],
         tags=["Settings"],
         summary="Get user settings")
async def get_settings(current_customer: Customer = Depends(get_current_customer)):
    """
    Retrieves the settings for the currently authenticated customer.
    """
    return current_customer.settings


@app.put("/settings",
         response_model=Dict[str, Any],
         tags=["Settings"],
         summary="Update user settings")
async def update_settings(settings_data: SettingsUpdate,
                          current_customer: Customer = Depends(get_current_customer),
                          db: AsyncSession = Depends(get_db)):
    """
    Updates the settings for the currently authenticated customer.
    """
    try:
        update_dict = settings_data.model_dump(exclude_unset=True)
        if not update_dict:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="No settings provided for update.")

        # Merge new settings with existing ones
        current_settings = current_customer.settings or {}
        current_settings.update(update_dict)
        current_customer.settings = current_settings

        await db.commit()
        await db.refresh(current_customer)

        logger.info(f"Settings updated for customer: {current_customer.email}")
        return current_customer.settings
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating settings: {e}")
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="An internal error occurred while updating settings.")


# --- Customer Management Endpoints (for admin/internal use) ---
@app.get(
    "/customers/{customer_id}",
    response_model=CustomerResponse,
    tags=["Customers"],
    summary="Get customer by ID",
    description="Retrieves a specific customer's details. Access is restricted to the customer themselves."
)
async def get_customer(customer_id: uuid.UUID,
                       current_customer: Customer = Depends(get_current_customer),
                       db: AsyncSession = Depends(get_db)):
    """
    Retrieves a customer by their ID. Currently, only allows customers to view their own profile.
    """
    try:
        if current_customer.customer_id != customer_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="Access denied.")

        result = await db.execute(
            select(Customer).where(Customer.customer_id == customer_id))
        customer = result.scalar_one_or_none()
        if not customer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail="Customer not found.")
        return CustomerResponse.model_validate(customer)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving customer '{customer_id}': {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Internal server error.")


# --- Zone Management Endpoints ---
@app.post(
    "/customers/{customer_id}/zones",
    response_model=ZoneResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Zones"],
    summary="Create a new zone for a customer")
async def create_zone(customer_id: uuid.UUID,
                      zone_data: ZoneCreate,
                      current_customer: Customer = Depends(get_current_customer),
                      db: AsyncSession = Depends(get_db)):
    """
    Creates a new zone for the specified customer.
    """
    try:
        if current_customer.customer_id != customer_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="Access denied.")

        new_zone = Zone(customer_id=customer_id,
                        zone_location_name=zone_data.zone_location_name)
        db.add(new_zone)
        await db.commit()
        await db.refresh(new_zone)

        logger.info(
            f"Zone '{new_zone.zone_location_name}' created for customer '{customer_id}'.")
        return ZoneResponse.model_validate(new_zone)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating zone for customer '{customer_id}': {e}")
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Internal server error.")


@app.get("/customers/{customer_id}/zones",
         response_model=List[ZoneResponse],
         tags=["Zones"],
         summary="Get all zones for a customer")
async def get_customer_zones(
        customer_id: uuid.UUID,
        current_customer: Customer = Depends(get_current_customer),
        db: AsyncSession = Depends(get_db)):
    """
    Retrieves all zones associated with a specific customer.
    """
    try:
        if current_customer.customer_id != customer_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="Access denied.")

        result = await db.execute(
            select(Zone).where(Zone.customer_id == customer_id).order_by(
                Zone.created_at))
        zones = result.scalars().all()
        return [ZoneResponse.model_validate(zone) for zone in zones]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving zones for customer '{customer_id}': {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Internal server error.")


@app.get("/zones/{zone_id}",
         response_model=ZoneResponse,
         tags=["Zones"],
         summary="Get a specific zone")
async def get_zone(zone_id: uuid.UUID,
                   current_customer: Customer = Depends(get_current_customer),
                   db: AsyncSession = Depends(get_db)):
    """
    Retrieves a single zone by its ID, ensuring it belongs to the authenticated customer.
    """
    try:
        result = await db.execute(
            select(Zone).where(Zone.zone_id == zone_id))
        zone = result.scalar_one_or_none()

        if not zone or zone.customer_id != current_customer.customer_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail="Zone not found or access denied.")
        return ZoneResponse.model_validate(zone)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving zone '{zone_id}': {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Internal server error.")


@app.put("/zones/{zone_id}",
         response_model=ZoneResponse,
         tags=["Zones"],
         summary="Update a zone")
async def update_zone(zone_id: uuid.UUID,
                      update_data: ZoneUpdate,
                      current_customer: Customer = Depends(get_current_customer),
                      db: AsyncSession = Depends(get_db)):
    """
    Updates a zone's details, ensuring it belongs to the authenticated customer.
    """
    try:
        result = await db.execute(select(Zone).where(Zone.zone_id == zone_id))
        zone = result.scalar_one_or_none()

        if not zone or zone.customer_id != current_customer.customer_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail="Zone not found or access denied.")

        update_dict = update_data.model_dump(exclude_unset=True)
        if not update_dict:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="No fields provided for update.")

        for key, value in update_dict.items():
            setattr(zone, key, value)
        await db.commit()
        await db.refresh(zone)

        logger.info(f"Zone '{zone_id}' updated.")
        return ZoneResponse.model_validate(zone)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating zone '{zone_id}': {e}")
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Internal server error.")


@app.delete("/zones/{zone_id}",
            status_code=status.HTTP_204_NO_CONTENT,
            tags=["Zones"],
            summary="Delete a zone")
async def delete_zone(zone_id: uuid.UUID,
                      current_customer: Customer = Depends(get_current_customer),
                      db: AsyncSession = Depends(get_db)):
    """
    Deletes a zone and all associated devices, ensuring it belongs to the authenticated customer.
    """
    try:
        result = await db.execute(select(Zone).where(Zone.zone_id == zone_id))
        zone = result.scalar_one_or_none()

        if not zone or zone.customer_id != current_customer.customer_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail="Zone not found or access denied.")

        await db.delete(zone)
        await db.commit()
        logger.info(f"Zone '{zone_id}' deleted.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting zone '{zone_id}': {e}")
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Internal server error.")


# --- Device Management Endpoints ---
@app.post(
    "/customers/{customer_id}/devices",
    response_model=DeviceResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Devices"],
    summary="Create a new device",
    description="Creates a new device for a customer. Can be authenticated via user JWT or device secret."
)
async def create_device(
        customer_id: uuid.UUID,
        device_data: DeviceCreate,
        current_customer_or_device: Optional[Customer] = Depends(
            get_current_customer_or_device_auth),
        db: AsyncSession = Depends(get_db)):
    """
    Creates a new device and associates it with a customer and zone.
    This endpoint supports both customer (JWT) and device (X-Device-Secret) authentication.
    """
    try:
        # If authenticated as a customer, ensure they are the owner of the resource
        if current_customer_or_device and current_customer_or_device.customer_id != customer_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="Access denied.")

        # Verify the customer exists
        customer_result = await db.execute(
            select(Customer).where(Customer.customer_id == customer_id))
        if not customer_result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail="Customer not found.")

        # Verify the zone exists and belongs to the customer
        zone_result = await db.execute(
            select(Zone).where((Zone.zone_id == device_data.zone_id) &
                               (Zone.customer_id == customer_id)))
        if not zone_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Zone not found or does not belong to the specified customer."
            )

        # Check if device already exists
        device_id_upper = device_data.device_id.upper()
        device_result = await db.execute(
            select(Device).where(Device.device_id == device_id_upper))
        if device_result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                detail="Device with this ID already exists.")

        # Create and save the new device
        new_device = Device(device_id=device_id_upper,
                            customer_id=customer_id,
                            zone_id=device_data.zone_id,
                            ac_brand_name=device_data.ac_brand_name,
                            ac_brand_protocol=device_data.ac_brand_protocol,
                            firmware_version=device_data.firmware_version)
        db.add(new_device)
        await db.commit()
        await db.refresh(new_device)

        logger.info(f"Device '{new_device.device_id}' created for customer '{customer_id}'.")
        return DeviceResponse.model_validate(new_device)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating device for customer '{customer_id}': {e}")
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Internal server error.")


@app.get("/customers/{customer_id}/devices",
         response_model=PaginatedResponse,
         tags=["Devices"],
         summary="Get all devices for a customer (paginated)")
async def get_customer_devices(
        customer_id: uuid.UUID,
        page: int = Query(1, ge=1, description="Page number"),
        page_size: int = Query(10,
                               ge=1,
                               le=100,
                               description="Number of devices per page"),
        current_customer: Customer = Depends(get_current_customer),
        db: AsyncSession = Depends(get_db)):
    """
    Retrieves a paginated list of all devices for a specific customer.
    """
    try:
        if current_customer.customer_id != customer_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="Access denied.")

        offset = (page - 1) * page_size

        # Get total count for pagination
        total_result = await db.execute(
            select(func.count(Device.device_id)).where(
                Device.customer_id == customer_id))
        total = total_result.scalar_one()

        # Get paginated devices
        devices_result = await db.execute(
            select(Device).where(Device.customer_id == customer_id).order_by(
                Device.created_at).offset(offset).limit(page_size))
        devices = devices_result.scalars().all()

        return PaginatedResponse(
            items=[DeviceResponse.model_validate(d) for d in devices],
            total=total,
            page=page,
            page_size=page_size)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving devices for customer '{customer_id}': {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Internal server error.")


@app.get("/devices/{device_id}",
         response_model=DeviceResponse,
         tags=["Devices"],
         summary="Get a specific device")
async def get_device(device_id: str,
                     current_customer: Customer = Depends(get_current_customer),
                     db: AsyncSession = Depends(get_db)):
    """
    Retrieves a single device by its ID, ensuring it belongs to the authenticated customer.
    """
    try:
        result = await db.execute(
            select(Device).where(Device.device_id == device_id.upper()))
        device = result.scalar_one_or_none()

        if not device or device.customer_id != current_customer.customer_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail="Device not found or access denied.")
        return DeviceResponse.model_validate(device)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving device '{device_id}': {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Internal server error")


@app.put("/devices/{device_id}",
         response_model=DeviceResponse,
         tags=["Devices"],
         summary="Update a device")
async def update_device(device_id: str,
                        update_data: DeviceUpdate,
                        current_customer: Customer = Depends(get_current_customer),
                        db: AsyncSession = Depends(get_db)):
    """
    Updates a device's details, ensuring it belongs to the authenticated customer.
    """
    try:
        result = await db.execute(select(Device).where(Device.device_id == device_id.upper()))
        device = result.scalar_one_or_none()

        if not device or device.customer_id != current_customer.customer_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail="Device not found or access denied.")

        update_dict = update_data.model_dump(exclude_unset=True)
        if not update_dict:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="No fields provided for update.")

        # Validate zone_id if present
        if "zone_id" in update_dict:
            result = await db.execute(select(Zone).where(Zone.zone_id == update_data.zone_id,
                                                         Zone.customer_id == current_customer.customer_id))
            zone = result.scalar_one_or_none()
            if not zone:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                    detail="Zone not found or does not belong to customer.")

        # Apply updates
        for key, value in update_dict.items():
            setattr(device, key, value)
        await db.commit()
        await db.refresh(device)

        logger.info(f"Device '{device_id}' updated.")
        return DeviceResponse.model_validate(device)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating device '{device_id}': {e}")
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Internal server error")


@app.delete("/devices/{device_id}",
            status_code=status.HTTP_204_NO_CONTENT,
            tags=["Devices"],
            summary="Delete a device")
async def delete_device(device_id: str,
                        current_customer: Customer = Depends(get_current_customer),
                        db: AsyncSession = Depends(get_db)):
    """
    Deletes a device, ensuring it belongs to the authenticated customer.
    """
    try:
        result = await db.execute(select(Device).where(Device.device_id == device_id.upper()))
        device = result.scalar_one_or_none()

        if not device or device.customer_id != current_customer.customer_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail="Device not found or access denied.")

        await db.delete(device)
        await db.commit()
        logger.info(f"Device '{device_id}' deleted.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting device '{device_id}': {e}")
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Internal server error")


@app.post("/validate-zone", response_model=dict)
async def validate_zone(validation_data: ZoneValidation,
                        current_customer_or_device: Optional[Customer] = Depends(get_current_customer_or_device_auth),
                        db: AsyncSession = Depends(get_db)):
    """
    Validates that a zone belongs to the customer and is correctly formatted.
    """
    try:
        result = await db.execute(select(Zone).where(Zone.zone_id == validation_data.zone_id,
                                                     Zone.customer_id == validation_data.customer_id))
        zone = result.scalar_one_or_none()
        if not zone:
            return {"valid": False, "message": "Zone does not belong to customer"}
        if current_customer_or_device and zone.customer_id != current_customer_or_device.customer_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="Access denied")
        logger.info(f"Zone validated: {validation_data.zone_id}")
        return {"valid": True, "message": "Zone is valid"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Zone validation error: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Internal server error")


# --- Device Control Endpoints ---
@app.post("/devices/{device_id}/command")
async def send_device_command(device_id: str, command_data: DeviceCommand,
                              current_customer: Customer = Depends(get_current_customer),
                              db: AsyncSession = Depends(get_db)):
    """
    Sends a command to a device, such as power on/off, mode change, or temperature set.
    """
    try:
        result = await db.execute(select(Device).where(Device.device_id == device_id.upper()))
        device = result.scalar_one_or_none()

        if not device or device.customer_id != current_customer.customer_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail="Device not found or access denied.")

        # Validate command values
        if command_data.command == "power" and command_data.value not in ["on", "off"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Invalid power command value.")
        elif command_data.command == "mode" and command_data.value not in ["auto", "cool", "heat", "dry", "fan"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Invalid mode command value.")
        elif command_data.command == "temperature":
            try:
                temp = int(command_data.value)
                if temp < 16 or temp > 30:
                    raise ValueError
            except ValueError:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                    detail="Temperature must be an integer between 16 and 30.")
        elif command_data.command == "fanspeed" and command_data.value not in ["auto", "low", "medium", "high"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Invalid fanspeed command value.")

        # Publish command to MQTT topic
        topic = f"node/{current_customer.customer_id}/{device_id}/command/{command_data.command}"
        mqtt_client.publish(topic, command_data.value, qos=1)
        logger.info(
            f"Command sent to MQTT topic {topic} for device {device_id}: {command_data.command} = {command_data.value}")
        return {"message": "Command sent successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Device command error: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Internal server error")


@app.post("/devices/{device_id}/ota")
async def trigger_ota_update(device_id: str, ota_data: OTAUpdate,
                             current_customer: Customer = Depends(get_current_customer),
                             db: AsyncSession = Depends(get_db)):
    """
    Triggers an OTA (Over-The-Air) firmware update for a device.
    """
    try:
        result = await db.execute(select(Device).where(Device.device_id == device_id.upper()))
        device = result.scalar_one_or_none()

        if not device or device.customer_id != current_customer.customer_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail="Device not found or access denied.")

        # Publish OTA update command to MQTT topic
        topic = f"node/{current_customer.customer_id}/{device_id}/ota"
        payload = f"{ota_data.firmware_url},{ota_data.firmware_version}"
        mqtt_client.publish(topic, payload, qos=1)
        logger.info(f"OTA update triggered for device {device_id}: version {ota_data.firmware_version}")
        return {"message": "OTA update triggered successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OTA update error: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Internal server error")


# --- Status History Endpoints ---
@app.get("/devices/{device_id}/status-history", response_model=PaginatedResponse)
async def get_status_history(
        device_id: str,
        page: int = Query(1, ge=1),
        page_size: int = Query(10, ge=1, le=100),
        current_customer: Customer = Depends(get_current_customer),
        db: AsyncSession = Depends(get_db)
):
    """
    Retrieves the status history for a device, with pagination.
    """
    try:
        result = await db.execute(select(Device).where(Device.device_id == device_id.upper()))
        device = result.scalar_one_or_none()

        if not device or device.customer_id != current_customer.customer_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail="Device not found or access denied.")

        offset = (page - 1) * page_size

        # Get total count for pagination
        total_result = await db.execute(
            select(func.count()).select_from(StatusHistory).where(StatusHistory.device_id == device_id.upper())
        )
        total = total_result.scalar()

        # Get paginated status history
        history_result = await db.execute(
            select(StatusHistory)
            .where(StatusHistory.device_id == device_id.upper())
            .order_by(StatusHistory.timestamp.desc())
            .offset(offset)
            .limit(page_size)
        )
        history = history_result.scalars().all()

        logger.info(f"Retrieved {len(history)} status history entries for device {device_id}")
        return PaginatedResponse(
            items=[StatusHistoryResponse.model_validate(h) for h in history],
            total=total,
            page=page,
            page_size=page_size
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Status history retrieval error: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Internal server error")


@app.delete("/devices/{device_id}/history", status_code=status.HTTP_204_NO_CONTENT)
async def delete_status_history(device_id: str, current_customer: Customer = Depends(get_current_customer),
                                db: AsyncSession = Depends(get_db)):
    """
    Deletes all status history entries for a device.
    """
    try:
        result = await db.execute(select(Device).where(Device.device_id == device_id.upper()))
        device = result.scalar_one_or_none()

        if not device or device.customer_id != current_customer.customer_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail="Device not found or access denied.")

        await db.execute(delete(StatusHistory).where(StatusHistory.device_id == device_id.upper()))
        await db.commit()
        logger.info(f"Status history deleted for device: {device_id}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Status history deletion error: {e}")
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Internal server error")


# --- WebSocket endpoint ---
@app.websocket("/ws/devices/{customer_id}")
async def websocket_endpoint(websocket: WebSocket, customer_id: str, token: str = Query(...),
                             db: AsyncSession = Depends(get_db)):
    logger.info(f"WebSocket upgrade request received for customer_id: {customer_id}")
    connection_accepted = False
    try:
        customer = await get_current_customer_ws(token, db)
        if str(customer.customer_id) != customer_id:
            logger.warning(
                f"Access denied: Token customer_id {customer.customer_id} does not match path customer_id {customer_id}")
            raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Access denied")

        await websocket.accept()
        connection_accepted = True
        logger.info(f"WebSocket connection established for customer {customer_id}")

        while True:
            try:
                result_devices = await db.execute(
                    select(Device)
                    .where(Device.customer_id == uuid.UUID(customer_id))
                    .order_by(Device.updated_at.desc())
                )
                devices = result_devices.scalars().all()
                device_data = [DeviceResponse.model_validate(device).model_dump(mode='json') for device in devices]
                await websocket.send_json({"type": "device_update", "data": device_data})

                if devices:
                    device_ids = [d.device_id for d in devices]
                    result_history = await db.execute(
                        select(StatusHistory)
                        .where(StatusHistory.device_id.in_(device_ids))
                        .order_by(StatusHistory.timestamp.desc())
                        .limit(100)
                    )
                    history = result_history.scalars().all()
                    history_data = [StatusHistoryResponse.model_validate(h).model_dump(mode='json') for h in history]
                    await websocket.send_json({"type": "status_history", "data": history_data})

                await asyncio.sleep(5)

            except WebSocketDisconnect as e:
                if e.code == status.WS_1005_NO_STATUS_RCVD:
                    logger.warning(
                        f"WebSocket disconnected without status (code 1005) for customer {customer_id}. Client might have closed abruptly.")
                elif e.code == status.WS_1000_NORMAL_CLOSURE or e.code == status.WS_1001_GOING_AWAY:
                    logger.info(f"WebSocket disconnected normally (code: {e.code}) for customer {customer_id}.")
                else:
                    logger.warning(
                        f"WebSocket disconnected with code: {e.code}, reason: '{e.reason}' for customer {customer_id}.")
                break
            except Exception as e:
                error_message = str(e).lower()
                is_abrupt_closure_error = (
                        "connection closed" in error_message or
                        "socket is closed" in error_message or
                        "received 1005" in error_message or
                        isinstance(e, ConnectionResetError)
                )

                if is_abrupt_closure_error:
                    logger.warning(
                        f"WebSocket connection likely closed abruptly for customer {customer_id} (Error type: {type(e).__name__}): {str(e)}")
                else:
                    logger.error(
                        f"Unexpected WebSocket processing error for customer {customer_id} (Error type: {type(e).__name__}): {str(e)}")

                if websocket.application_state != WebSocketState.DISCONNECTED:
                    try:
                        await websocket.close(code=status.WS_1011_INTERNAL_ERROR, reason="Server processing error")
                    except RuntimeError as rt_err:
                        logger.warning(
                            f"RuntimeError when trying to close WebSocket for customer {customer_id} (loop might be closing): {rt_err}")
                    except Exception as close_exc:
                        logger.error(
                            f"Further error when trying to close WebSocket for customer {customer_id} after processing error: {close_exc}")
                break

    except WebSocketException as e:
        logger.warning(
            f"WebSocket setup or authentication error for customer {customer_id}: Code {e.code}, Reason: {e.reason}")
        if connection_accepted and websocket.application_state != WebSocketState.DISCONNECTED:
            await websocket.close(code=e.code, reason=e.reason)
    except Exception as e:
        logger.error(f"General error during WebSocket connection setup for customer {customer_id}: {str(e)}")
        if connection_accepted and websocket.application_state != WebSocketState.DISCONNECTED:
            await websocket.close(code=status.WS_1011_INTERNAL_SERVER_ERROR,
                                  reason="Unexpected server error during connection setup")


# --- Test WebSocket Endpoint ---
@app.websocket("/ws/test")
async def websocket_test_endpoint(websocket: WebSocket):
    try:
        await websocket.accept()
        logger.info("Test WebSocket connection established")
        await websocket.send_text("Test WebSocket connection successful")
        while True:
            try:
                data = await websocket.receive_text()
                logger.debug(f"Received from test WebSocket: {data}")
                await websocket.send_text(f"Echo: {data}")
            except WebSocketDisconnect:
                logger.info("Test WebSocket disconnected normally")
                break
    except Exception as e:
        logger.error(f"Test WebSocket error: {str(e)}")
        if websocket.application_state != WebSocketState.DISCONNECTED:
            await websocket.close(code=1011, reason="Internal server error")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)