# AC Control Firmware

[![Build Status](https://img.shields.io/badge/PlatformIO-Build-green.svg)](https://platformio.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This project contains the firmware for an ESP8266-based IoT device to control an Air Conditioner unit remotely. It uses an IR LED to send commands to the AC and can be integrated with a home automation system via MQTT.

![Firmware Workflow](..\assets\firmware-workflow.png)

## Features

- **Wi-Fi Connectivity:** Connects to your local Wi-Fi network.
- **AP Mode for Configuration:** On first boot or if Wi-Fi connection fails, it starts an Access Point (AP) with a web server to configure Wi-Fi credentials and other settings.
- **Remote Control via MQTT:** Control your AC from anywhere using the MQTT protocol.
- **IR Blaster:** Sends IR signals to the AC unit, emulating the original remote control.
- **State Persistence:** Saves the last known AC state (power, mode, temperature, fan speed) and configuration to the onboard LittleFS file system.
- **Over-the-Air (OTA) Updates:** Update the firmware remotely without needing physical access to the device.
- **Multi-Brand Support:** Supports a wide range of AC brands and protocols through the `IRremoteESP8266` library.
- **Automatic Protocol Testing:** A web-based interface to test and find the correct IR protocol for your AC brand.

## How It Works

1.  **First Boot (AP Mode):**
    - When the device is powered on for the first time, it doesn't have any Wi-Fi credentials saved.
    - It enters AP mode and creates a unique Wi-Fi network with an SSID like `AC_Control_XXXXXX`.
    - You can connect to this network using the password `password123`.
    - Once connected, open a browser and navigate to `http://192.168.4.1` to access the configuration portal.

2.  **Configuration:**
    - **Wi-Fi Setup:** Scan for available Wi-Fi networks and enter the password for your network.
    - **Device Configuration:** After setting up Wi-Fi, you'll be prompted to configure other parameters like Customer ID, Zone ID, and AC Brand/Protocol.
    - **Protocol Testing:** If you don't know the exact protocol for your AC, you can use the testing feature to cycle through protocols for your selected brand and test them.

3.  **Normal Operation (Client Mode):**
    - After configuration, the device reboots and connects to your Wi-Fi network.
    - It then connects to the configured MQTT broker.
    - It listens for commands on specific MQTT topics to control the AC.
    - It also publishes its status and telemetry data to other MQTT topics.

4.  **Reset:**
    - The device can be reset to factory settings by accessing a specific endpoint, which will clear the configuration and restart it in AP mode.

## Hardware Requirements

- **ESP8266 Development Board:** A Wemos D1 Mini is used in this project, but any similar ESP8266 board should work.
- **IR LED:** To send signals to the Air Conditioner.
- **(Optional) Transistor and Resistor:** To amplify the IR signal if the bare LED is not powerful enough.

## Software and Libraries

This project is built using the [PlatformIO IDE](https://platformio.org/).

The main libraries used are:
- `IRremoteESP8266`: For sending IR signals.
- `PubSubClient`: For MQTT communication.
- `ArduinoJson`: For parsing and generating JSON data.
- `ESP8266WebServer` & `DNSServer`: For the configuration web portal.
- `ESP8266HTTPClient` & `ESP8266httpUpdate`: For OTA updates.
- `LittleFS`: For storing configuration files.

## Setup and Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/whoisjayd/Internship-Project-AC-Control-IOT.git
    cd AC-Control-Firmware
    ```
2.  **Open in PlatformIO:** Open the project folder in VS Code with the PlatformIO extension installed.
3.  **Build and Upload:**
    - Connect your ESP8266 board to your computer.
    - Build the project and upload the firmware using the PlatformIO toolbar.
4.  **Configure:** Follow the steps in the "How It Works" section to configure the device.

## MQTT API

The device communicates using the following MQTT topics:

-   **Command Topic:** `ac/control/{customer_id}/{zone_id}/command`
    -   Receives commands to change the AC state.
    -   Payload is a JSON object, e.g., `{"power": "ON"}`, `{"temperature": 22}`.
-   **Status Topic:** `ac/control/{customer_id}/{zone_id}/status`
    -   Publishes the current state of the AC.
    -   Payload is a JSON object describing the full state.
-   **Telemetry Topic:** `ac/control/{customer_id}/{zone_id}/telemetry`
    -   Periodically publishes telemetry data like Wi-Fi signal strength (RSSI).
-   **Error Topic:** `ac/control/{customer_id}/{zone_id}/error`
    -   Publishes any errors that occur on the device.
-   **OTA Topic:** `ac/control/{customer_id}/{zone_id}/ota`
    -   Receives commands for Over-the-Air updates.
    -   Payload is a JSON object with the firmware URL and new version, e.g., `{"url": "http://example.com/firmware.bin", "version": "1.0.3"}`.

*(Note: The exact topic structure may vary based on the `customer_id` and `zone_id` configured on the device.)*

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue if you have any suggestions or find any bugs.
