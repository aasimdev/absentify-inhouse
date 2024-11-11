import { generateOpenApiDocument } from 'trpc-openapi';
import { apiV1Router } from './root';

// Generate OpenAPI schema document
export const openApiDocument = generateOpenApiDocument(apiV1Router, {
  title: 'absentify CRUD API',
  description: 'OpenAPI compliant REST API',
  version: '1.0.0',
  baseUrl: 'https://api.absentify.com/api/v1',
  docsUrl: 'https://absentify.com/docs/api-reference',
  tags: ['Departments', 'Leave types', 'Members', 'Requests', 'Public holidays', "Workspace", "Absences"],
  securitySchemes: {
    ApiKey: {
      type: 'apiKey',
      name: 'X-API-KEY',
      in: 'header'
    },
  }
});
