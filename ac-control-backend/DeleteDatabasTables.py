"""
This script connects to a PostgreSQL database and drops all tables in the 'public' schema.

WARNING: This is a destructive operation and should be used with extreme caution.

Usage:
    python DeleteDatabasTables.py

Environment Variables:
    - DATABASE_URL: Database connection string

Dependencies:
    - asyncpg
    - python-dotenv
"""

import asyncio
import os
from typing import List

import asyncpg
from dotenv import load_dotenv

# Load environment variables from a .env file
load_dotenv()

# It is recommended to use a separate, less privileged user for this operation.
DATABASE_URL = os.getenv("DATABASE_URL")


async def drop_all_tables(db_url: str) -> None:
    """
    Connects to a PostgreSQL database and drops all tables in the 'public' schema.

    Args:
        db_url (str): The connection string for the database.

    Returns:
        None
    """
    if not db_url:
        print("Error: DATABASE_URL environment variable not set.")
        return

    conn = None
    try:
        conn = await asyncpg.connect(db_url)
        print("Successfully connected to the database.")

        # Get all table names in the 'public' schema
        tables: List[asyncpg.Record] = await conn.fetch(
            """
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public';
            """
        )

        if not tables:
            print("No tables found in the 'public' schema.")
            return

        table_names: List[str] = [table['tablename'] for table in tables]
        print(f"Found tables: {', '.join(table_names)}")

        # User confirmation to prevent accidental deletion
        confirm = input(
            "Are you sure you want to drop all tables in the 'public' schema? (yes/no): "
        )
        if confirm.lower() != "yes":
            print("Operation cancelled.")
            return

        async with conn.transaction():
            # Drop tables one by one with CASCADE to handle dependencies.
            for table_name in table_names:
                drop_query = f'DROP TABLE IF EXISTS public."{table_name}" CASCADE;'
                print(f"Executing: {drop_query}")
                await conn.execute(drop_query)
                print(f"Successfully dropped table: {table_name}")

        print(
            "\nAll tables in the 'public' schema have been dropped successfully."
        )

    except asyncpg.PostgresError as e:
        print(f"Database error: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
    finally:
        if conn:
            await conn.close()
            print("Database connection closed.")


async def main() -> None:
    """
    Main function to run the script.
    Runs the drop_all_tables coroutine.
    """
    print("--- Starting Table Deletion Script ---")
    await drop_all_tables(DATABASE_URL)
    print("--- Table Deletion Script Finished ---")


if __name__ == "__main__":
    # Ensure the script is run directly and not imported.
    asyncio.run(main())
