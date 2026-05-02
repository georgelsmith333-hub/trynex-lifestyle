export interface Env {
  DATABASE_URL: string;
  JWT_SECRET: string;
  ADMIN_JWT_SECRET: string;
  ADMIN_PASSWORD: string;
  ADMIN_SECRET_PASSWORD: string;
  ADMIN_SALT: string;
  ADMIN_RESET_KEY: string;
  ADMIN_RESET_KEY_HASH: string;
  ADMIN_RESET_KEY_FORCE_SYNC: string;
  ALLOWED_ORIGINS: string;
  CALLMEBOT_PHONE: string;
  CALLMEBOT_APIKEY: string;
  GOOGLE_CLIENT_ID: string;
  CUSTOMER_SALT: string;
  NODE_ENV: string;
  APP_VERSION: string;
  R2: R2Bucket;
}

export type AppEnv = {
  Bindings: Env;
  Variables: {
    adminSession: { id: number; role: string; adminId: number | null } | undefined;
  };
};
