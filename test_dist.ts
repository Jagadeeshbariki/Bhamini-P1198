import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

console.log("Checking mappings...");

const csv = `FARMERID,ACTIVITY
123,PROCESSING HUBS`;
