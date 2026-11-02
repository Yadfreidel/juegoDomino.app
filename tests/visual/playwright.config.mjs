import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'**/*.spec.mjs',timeout:240000,expect:{timeout:20000},workers:1,reporter:'list',use:{baseURL:process.env.PATIO_TEST_URL||'http://127.0.0.1:5091',headless:true,viewport:{width:1440,height:900},screenshot:'only-on-failure'}});
