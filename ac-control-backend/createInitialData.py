"""
This script creates initial data for the AC Control FastAPI application.

It performs the following actions:
1. Registers a new customer.
2. Logs in the customer to obtain an access token.
3. Creates a new zone for the customer.
4. Creates a new device within that zone.
5. Simulates receiving a status update via WebSocket.

This script is intended for setting up a development or test environment.

Usage:
    python createInitialData.py

Environment Variables:
    - DATABASE_URL: Database connection string
    - API_BASE_URL: Base URL for the FastAPI server (default: http://127.0.0.1:8000)
    - WEBSOCKET_URL: WebSocket URL template (default: ws://127.0.0.1:8000/ws/devices/{customer_id}?token={token})

Dependencies:
    - aiohttp
    - websockets
    - python-dotenv
    - sqlalchemy[asyncio]
"""

import asyncio
import json
import logging
import os
import uuid
from datetime import datetime
from typing import Dict, Any, Tuple
from urllib.parse import urlparse, parse_qs, urlencode

import aiohttp
import websockets
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# Load environment variables from a .env file
load_dotenv()

# --- Configuration ---
DATABASE_URL = os.getenv("DATABASE_URL")
API_BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")
WEBSOCKET_URL_TEMPLATE = os.getenv(
    "WEBSOCKET_URL", "ws://127.0.0.1:8000/ws/devices/{customer_id}?token={token}"
)

# --- Logging Setup ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger(__name__)


# --- Database Setup ---
def parse_database_url(url: str) -> Tuple[str, Dict[str, Any]]:
    """Parses the database URL to extract connection arguments.

    Args:
        url (str): The database connection string.
    Returns:
        Tuple[str, Dict[str, Any]]: The parsed URL and connection arguments.
    Raises:
        ValueError: If the URL is not set or invalid.
    """
    if not url:
        raise ValueError("DATABASE_URL is not set.")
    try:
        parsed = urlparse(url)
        query = parse_qs(parsed.query)
        connect_args = {}
        if "statement_cache_size" in query:
            connect_args["statement_cache_size"] = int(query["statement_cache_size"][0])
            del query["statement_cache_size"]
        new_query = urlencode(query, doseq=True)
        new_url = parsed._replace(query=new_query).geturl()
        return new_url, connect_args
    except Exception as e:
        logger.error(f"Error parsing DATABASE_URL: {e}")
        raise ValueError(f"Invalid DATABASE_URL format: {e}")


try:
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable must be set.")
    new_database_url, connect_args = parse_database_url(DATABASE_URL)
    engine = create_async_engine(
        new_database_url,
        connect_args=connect_args,
        echo=False,
        pool_size=5,
        max_overflow=10,
    )
    async_session = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
except ValueError as e:
    logger.critical(e)
    exit(1)
except Exception as e:
    logger.critical(f"Failed to initialize database engine: {e}")
    exit(1)


async def get_db() -> AsyncSession:
    """Dependency injection for database sessions.

    Yields:
        AsyncSession: An asynchronous SQLAlchemy session.
    """
    async with async_session() as session:
        try:
            yield session
        except Exception as e:
            logger.error(f"Database session error: {e}")
            await session.rollback()
            raise
        finally:
            await session.close()


# --- API Interaction Functions ---
async def register_customer(
    session: aiohttp.ClientSession, email: str, username: str, password: str
) -> Dict[str, Any]:
    """Registers a new customer with the API.

    Args:
        session (aiohttp.ClientSession): The HTTP session.
        email (str): Customer email.
        username (str): Customer username.
        password (str): Customer password.
    Returns:
        dict: API response data.
    """
    url = f"{API_BASE_URL}/auth/register"
    payload = {
        "email": email,
        "username": username,
        "password": password,
        "company_name": "Test Company",
        "company_address": "123 Test St, Test City",
        "phone_no": "+1234567890",
        "country": "Test Country",
        "state": "Test State",
        "city": "Test City",
    }
    async with session.post(url, json=payload) as response:
        response.raise_for_status()
        data = await response.json()
        logger.info(f"Successfully registered customer: {email}")
        return data


async def login_customer(
    session: aiohttp.ClientSession, email: str, password: str
) -> Dict[str, Any]:
    """Logs in a customer and returns authentication details.

    Args:
        session (aiohttp.ClientSession): The HTTP session.
        email (str): Customer email.
        password (str): Customer password.
    Returns:
        dict: API response data.
    """
    url = f"{API_BASE_URL}/auth/login"
    payload = {"email": email, "password": password}
    async with session.post(url, json=payload) as response:
        response.raise_for_status()
        data = await response.json()
        logger.info(f"Successfully logged in customer: {email}")
        return data


async def create_zone(
    session: aiohttp.ClientSession, token: str, customer_id: str, zone_name: str
) -> Dict[str, Any]:
    """Creates a new zone for a customer.

    Args:
        session (aiohttp.ClientSession): The HTTP session.
        token (str): JWT access token.
        customer_id (str): Customer ID.
        zone_name (str): Name of the zone.
    Returns:
        dict: API response data.
    """
    url = f"{API_BASE_URL}/zones/"
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"customer_id": customer_id, "name": zone_name}
    async with session.post(url, json=payload, headers=headers) as response:
        response.raise_for_status()
        data = await response.json()
        logger.info(f"Successfully created zone: {zone_name}")
        return data


async def create_device(
    session: aiohttp.ClientSession, token: str, zone_id: str, device_name: str
) -> Dict[str, Any]:
    """Creates a new device in a zone.

    Args:
        session (aiohttp.ClientSession): The HTTP session.
        token (str): JWT access token.
        zone_id (str): Zone ID.
        device_name (str): Name of the device.
    Returns:
        dict: API response data.
    """
    url = f"{API_BASE_URL}/devices/"
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "zone_id": zone_id,
        "name": device_name,
        "device_type": "AC",
        "model_number": "AC-12345",
        "installation_date": datetime.utcnow().isoformat(),
    }
    async with session.post(url, json=payload, headers=headers) as response:
        response.raise_for_status()
        data = await response.json()
        logger.info(f"Successfully created device: {device_name}")
        return data


async def listen_to_websocket(customer_id: str, token: str):
    """Connects to the WebSocket and listens for messages.

    Args:
        customer_id (str): Customer ID.
        token (str): JWT access token.
    """
    url = WEBSOCKET_URL_TEMPLATE.format(customer_id=customer_id, token=token)
    try:
        async with websockets.connect(url) as websocket:
            logger.info(f"Connected to WebSocket at {url}")
            # Simulate receiving a status update
            status_update = {
                "device_id": "some_device_id",  # Replace with actual device ID if known
                "status": "on",
                "temperature": 22.5,
            }
            await websocket.send(json.dumps(status_update))
            logger.info(f"Sent status update: {status_update}")

            response = await websocket.recv()
            logger.info(f"Received from WebSocket: {response}")
    except Exception as e:
        logger.error(f"WebSocket connection failed: {e}")


# --- Main Execution ---
async def main():
    """Main function to orchestrate the data creation process."""
    logger.info("--- Starting Initial Data Creation Script ---")
    # Use a secure, unique password for the test user
    test_password = "Str0ngP@ssw0rd!"
    unique_email = f"testuser_{uuid.uuid4()}@example.com"
    unique_username = f"testuser_{uuid.uuid4()}"

    async with aiohttp.ClientSession() as http_session:
        try:
            # 1. Register Customer
            customer_data = await register_customer(
                http_session, unique_email, unique_username, test_password
            )
            customer_id = customer_data["customer"]["id"]

            # 2. Login Customer
            login_data = await login_customer(http_session, unique_email, test_password)
            token = login_data["access_token"]

            # 3. Create Zone
            zone_data = await create_zone(
                http_session, token, customer_id, "Main Office"
            )
            zone_id = zone_data["id"]

            # 4. Create Device
            device_data = await create_device(
                http_session, token, zone_id, "Main AC Unit"
            )
            device_id = device_data["id"]
            logger.info(f"Device created with ID: {device_id}")

            # 5. Listen to WebSocket (optional)
            # await listen_to_websocket(customer_id, token)

        except aiohttp.ClientResponseError as e:
            logger.error(f"API request failed: {e.status} {e.message} - {e.history}")
        except Exception as e:
            logger.error(f"An unexpected error occurred: {e}")

    logger.info("--- Initial Data Creation Script Finished ---")


if __name__ == "__main__":
    # Ensure the script is run directly and not imported.
    asyncio.run(main())
