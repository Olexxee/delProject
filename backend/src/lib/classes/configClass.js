import { config } from "dotenv";

config();

class ConfigService {
  get(key) {
    return process.env[key];
  }

  getOrThrow(key) {
    const value = this.get(key);
    if (!value) {
      throw new Error(`Environment variable ${key} is not set.`);
    }
    return value;
  }
  getBaseUrl() {
    const protocol = process.env.BASE_PROTOCOL || "http";
    const host = process.env.BASE_HOST || "localhost";
    const port = process.env.PORT || "0000";
    return `${protocol}://${host}:${port}`;
  }
}
const configService = new ConfigService();

export default configService;
