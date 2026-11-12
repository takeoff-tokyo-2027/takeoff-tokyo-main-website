import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./test/browser',use:{baseURL:'http://127.0.0.1:4173',headless:true},workers:1});
