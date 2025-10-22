# OpenSearch Search Engine

This repository contains the foundational setup for a Node.js and TypeScript-based search engine service that integrates with OpenSearch. The project currently provides the initial structure and tooling required to begin development.

## Project Structure

```
├── config/           # Configuration files and utilities
├── src/              # Application source code
├── tests/            # Automated tests
├── .env.example      # Template for environment variables
├── package.json      # Project metadata and scripts
├── tsconfig.json     # TypeScript configuration
└── README.md         # Project documentation
```

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm 9 or later

### Installation

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and update the values as needed:

   ```bash
   cp .env.example .env
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

## Available Scripts

- `npm run dev`: Executes the app in development mode using `ts-node`.
- `npm run build`: Compiles the TypeScript source into JavaScript using `tsc`.
- `npm start`: Runs the compiled application from the `dist` directory.
- `npm test`: Placeholder test command.

## Next Steps

- Configure OpenSearch connection settings inside the `config/` directory.
- Implement core search functionality in the `src/` directory.
- Add unit and integration tests within the `tests/` directory.

## License

This project is licensed under the MIT License.
