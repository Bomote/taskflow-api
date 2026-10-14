import { readFileSync } from "node:fs";


function readPackageField(field: 'name' | 'version'): string {
    try {
        const raw = readFileSync(new URL('../../package.json', import.meta.url), 'utf-8');
        const value = (JSON.parse(raw) as Record<string, unknown>)[field];
        return typeof value === 'string' ? value : 'unknown';
    }
    catch {
        return 'unknown';
    }
}

export const appInfo = {
    name: readPackageField('name'),
    version: readPackageField('version'),
}