# Knowbase API

A powerful, clean, and efficient knowledge base API built with **NestJS**, **Drizzle ORM**, and **PostgreSQL**.

## 🚀 Features

- **🔐 Robust Authentication**: Secure access via Google OAuth2 and JWT-based authentication.
- **🏢 Workspace Management**: Organize your data with workspaces, allowing for seamless collaboration and multi-tenancy.
- **📄 Document Management**: Create, manage, and query documents efficiently within your workspaces.
- **💾 Modern Tech Stack**: Built with TypeScript, Drizzle ORM for type-safe database interactions, and NestJS for a scalable architecture.

## 🛠️ Tech Stack

- **Framework**: [NestJS](https://nestjs.com/)
- **Database**: [PostgreSQL](https://www.postgresql.org/) (driver: [postgres](https://github.com/porsager/postgres))
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **Auth**: [Passport.js](https://www.passportjs.org/) (JWT & Google OAuth2)
- **Validation**: [class-validator](https://github.com/typestack/class-validator) & [class-transformer](https://github.com/typestack/class-transformer)

## 🏁 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [pnpm](https://pnpm.io/)
- [PostgreSQL](https://www.postgresql.org/)

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/your-username/knowbase-api.git
    cd knowbase-api
    ```

2.  **Install dependencies**:
    ```bash
    pnpm install
    ```

3.  **Configure environment variables**:
    Create a `.env` file in the root directory and add the necessary configuration. Refer to `.env.example` (if available) or the configuration below:
    ```env
    DATABASE_URL=postgres://user:password@localhost:5432/knowbase
    JWT_SECRET=your_jwt_secret
    GOOGLE_CLIENT_ID=your_google_id
    GOOGLE_CLIENT_SECRET=your_google_secret
    ```

4.  **Database Migration**:
    ```bash
    pnpm drizzle-kit push
    ```

### Running the Project

```bash
# Development (watch mode)
pnpm run start:dev

# Production
pnpm run build
pnpm run start:prod
```

## 📜 Available Scripts

- `pnpm run build`: Build the application for production.
- `pnpm run format`: Format code using Prettier.
- `pnpm run lint`: Lint code using ESLint.
- `pnpm run test`: Run unit tests using Jest.
- `pnpm run test:e2e`: Run end-to-end tests.
- `pnpm run test:cov`: Generate test coverage report.

## 📄 License

This project is [UNLICENSED](LICENSE).
