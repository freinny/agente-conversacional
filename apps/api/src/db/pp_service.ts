import { ConfidentialClientApplication } from '@azure/msal-node';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface PowerPlatformConfig {
  organizationUrl: string;
  clientId: string;
  clientSecret: string;
  tenantId: string;
}

export interface ApiCollectionResponse<T> {
  value: T[];
  [key: string]: any;
}

export class PowerPlatformService {
  private config: PowerPlatformConfig;
  private msalClient: ConfidentialClientApplication;
  private accessToken: string | null = null;
  private tokenExpirationTime: number = 0;

  constructor(config: PowerPlatformConfig) {
    this.config = config;
    this.msalClient = new ConfidentialClientApplication({
      auth: {
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
        authority: `https://login.microsoftonline.com/${this.config.tenantId}/v2.0`,
      }
    });
  }

  private async getAccessToken(): Promise<string> {
    const currentTime = Date.now();
    if (this.accessToken && this.tokenExpirationTime > currentTime) {
      return this.accessToken;
    }

    try {
      const result = await this.msalClient.acquireTokenByClientCredential({
        scopes: [`${this.config.organizationUrl}/.default`],
      });

      if (!result || !result.accessToken) {
        throw new Error('Failed to acquire access token');
      }

      this.accessToken = result.accessToken;
      if (result.expiresOn) {
        this.tokenExpirationTime = result.expiresOn.getTime() - (5 * 60 * 1000);
      }
      return this.accessToken;
    } catch (error) {
      console.error('Error acquiring access token:', error);
      throw new Error('Authentication failed');
    }
  }

  public async makeRequest<T>(method: string, endpoint: string, data?: any): Promise<T> {
    try {
      const token = await this.getAccessToken();
      const response = await axios({
        method,
        url: `${this.config.organizationUrl}/${endpoint}`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0'
        },
        data
      });
      return response.data as T;
    } catch (error: any) {
      console.error(`PowerPlatform API request failed [${method} ${endpoint}]:`, error.response?.data || error.message);
      throw error;
    }
  }

  async getEntityMetadata(entityName: string): Promise<any> {
    return this.makeRequest('GET', `api/data/v9.2/EntityDefinitions(LogicalName='${entityName}')`);
  }

  async createTable(entityDefinition: any): Promise<any> {
    return this.makeRequest('POST', `api/data/v9.2/EntityDefinitions`, entityDefinition);
  }

  async createOneToManyRelationship(entityName: string, relationshipDefinition: any): Promise<any> {
    return this.makeRequest('POST', `api/data/v9.2/EntityDefinitions(LogicalName='${entityName}')/OneToManyRelationships`, relationshipDefinition);
  }
}

export const ppService = new PowerPlatformService({
  organizationUrl: process.env.DATAVERSE_URL!,
  clientId: process.env.DATAVERSE_CLIENT_ID!,
  clientSecret: process.env.DATAVERSE_CLIENT_SECRET!,
  tenantId: process.env.DATAVERSE_TENANT_ID!
});
