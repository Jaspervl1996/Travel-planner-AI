// Fixed type definition error by replacing vite/client reference with explicit process declaration
declare const process: {
  env: {
    API_KEY: string;
    [key: string]: string | undefined;
  }
}
