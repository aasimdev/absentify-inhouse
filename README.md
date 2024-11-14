# absentify app

This guide provides steps for setting up the project from scratch as a new developer.

## Prerequisites

Make sure the following are installed:

1. **Docker**: Follow the installation instructions [here](https://docs.docker.com/get-docker/) to install Docker for your platform.
2. **Node.js** (version 18 or higher): Download and install from [Node.js official site](https://nodejs.org/).
3. **Yarn**: After installing Node.js, you can install Yarn globally by running:
   ```bash
   npm install --global yarn
   ```

## Setup Instructions

### 1. Clone the Repository

Clone the repository and navigate to the project directory:

```bash
git clone <repository-url>
cd <project-directory>
```

### 2. Set Up Environment Variables

Copy the provided `.env-dev` file to create your own `.env` file:

```bash
cp .env-dev .env
```

Update the MySQL root password and the Prisma connection string in the `.env` file:

```env
MYSQL_ROOT_PASSWORD="yourRootPassword"
MYSQL_DATABASE="absentify"
MYSQL_USER="absentifyadmin"
MYSQL_PASSWORD="yourUserPassword"

PRISMA_DATABASE_URL="mysql://absentifyadmin:yourUserPassword@localhost:3306/absentify"
```

Replace `yourRootPassword` and `yourUserPassword` with secure passwords.

### 3. Install Dependencies

Install the required Node.js packages with Yarn:

```bash
yarn install
```

### 4. Set Up Database and Prisma

The project uses Docker to start a MySQL container and Prisma to manage the database schema. Run the following command to start the MySQL container and initialize the database schema:

```bash
yarn run start-docker
```

This command will:
- Start Docker containers for MySQL
- Initialize the database schema based on the Prisma configuration

### 5. Run Prisma Database Migration

Use Prisma to ensure the database schema is up-to-date:

```bash
npx prisma db push
```

> **Note:** If you make changes to the database schema later, you can also use `yarn db:push` or `yarn db:reset`.

### 6. Start the Development Server

To start the development server, run:

```bash
yarn dev
```

This command performs several actions:
- Sets `NEXT_PUBLIC_IS_LOCALHOST=true`
- Starts the Next.js development server
- Runs `Inngest` for local development using the API URL `http://localhost:3000/api/inngest`

The application should now be accessible at [http://localhost:3000](http://localhost:3000).

## Changing the Database Password

If you need to change the database password after initial setup, follow these steps:

1. **Update the `docker-compose.yml` and `.env` Files**:
   - Open `docker-compose.yml` and change the values of `MYSQL_ROOT_PASSWORD` and `MYSQL_PASSWORD` to your new password.
   - Open the `.env` file and update `PRISMA_DATABASE_URL` with the new password.

2. **Remove Existing Docker Volumes**:
   - Since the database stores user credentials, you’ll need to delete the existing Docker volumes to reset the database with the new password. Run:
     ```bash
     docker-compose down -v
     ```

3. **Restart Docker Containers**:
   - Start the containers with the updated credentials:
     ```bash
     yarn run start-docker
     ```

4. **Run Prisma Database Migration** (if necessary):
   - Re-run the database migration to ensure the schema is applied:
     ```bash
     npx prisma db push
     ```

## Useful Commands

- **Stop the Server**: Stops the Docker container
  ```bash
  yarn run stop-docker
  ```

- **Prisma Studio**: Opens a web interface for managing database content
  ```bash
  yarn db:studio
  ```

- **Run Tests**: Executes unit tests with Vitest
  ```bash
  yarn test
  ```
  
