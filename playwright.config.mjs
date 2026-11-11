import { defineConfig, devices } from '@playwright/test';
export default defineConfig({testDir:'./tests',use:{baseURL:'http://127.0.0.1:4173'},webServer:{command:'npx http-server dist -p 4173 -c-1',port:4173,reuseExistingServer:true},projects:[{name:'pixel',use:{...devices['Pixel 7']}},{name:'iphone',use:{...devices['iPhone 15']}}]});
