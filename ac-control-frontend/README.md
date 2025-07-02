# AC Control Frontend

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://ac-control-frontend.vercel.app)

A modern, responsive web application for controlling your Air Conditioning system remotely. This project is built with the latest web technologies to provide a seamless user experience.

## About The Project

The AC Control Frontend is a comprehensive solution for managing and monitoring your smart air conditioning units. It provides a sleek, user-friendly interface that allows for intuitive control over individual devices or groups of devices organized into zones. With real-time status updates via MQTT and efficient backend communication, you can be sure you're always in control of your environment.

## Key Features

*   **Real-time Dashboard**: Get an at-a-glance overview of your entire AC system.
    *   View key statistics: total devices, online devices, active devices, and configured zones.
    *   Live MQTT connection status indicator.
    *   Quick access to common actions like adding devices, creating zones, and batch control.

*   **Device Management**: Full control over individual AC units.
    *   Turn devices on or off.
    *   Adjust mode (Cool, Heat, Fan), temperature, and fan speed.
    *   View real-time status, including online/offline state and current settings.

*   **Zone Control**: Group devices by location for simplified management.
    *   Create custom zones (e.g., "Living Room", "Upstairs").
    *   Apply commands to all devices within a zone simultaneously.

*   **Batch Operations**: Control multiple devices at once, even across different zones.
    *   Select specific devices and apply a single command to all of them.

*   **Efficient & Reliable**: Built for performance and stability.
    *   Smart command queueing and API rate-limiting to prevent overloading the backend.
    *   Responsive design that works seamlessly on desktop, tablets, and mobile devices.
    *   Toast notifications for clear user feedback on actions.

*   **Secure Authentication**: User accounts are protected to ensure only authorized access.

### Built With

This project is built using a modern tech stack:

*   [Next.js](https://nextjs.org/) - The React Framework for Production.
*   [React](https://reactjs.org/) - A JavaScript library for building user interfaces.
*   [TypeScript](https://www.typescriptlang.org/) - A typed superset of JavaScript that compiles to plain JavaScript.
*   [Tailwind CSS](https://tailwindcss.com/) - A utility-first CSS framework for rapid UI development.
*   [Shadcn/ui](https://ui.shadcn.com/) components (using Radix UI and Tailwind CSS).
*   [React Hook Form](https://react-hook-form.com/) for form management.
*   [Zod](https://zod.dev/) for schema validation.

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

Make sure you have `pnpm` installed. If not, you can install it via npm:
```sh
npm install -g pnpm
```

### Installation

1.  Clone the repository:
    ```sh
    git clone https://github.com/whoisjayd/Internship-Project-AC-Control-IOT.git
    ```
2.  Navigate to the project directory:
    ```sh
    cd ac-control-frontend
    ```
3.  Install dependencies:
    ```sh
    pnpm install
    ```
4.  Run the development server:
    ```sh
    pnpm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Deployment

This application is deployed on [Vercel](https://vercel.com/). The production build is automatically updated when changes are pushed to the `main` branch.
