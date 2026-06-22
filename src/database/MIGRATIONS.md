# Database Migration Guide

## Principle: Never Auto-Delete User Data

**Smart Market uses RxDB with Dexie storage. The most critical rule is:**
> If a schema mismatch occurs after an app update, **the application will NOT automatically delete the database**. It will show an error and instruct the user to manually export, clear, and re-import their data.

This prevents accidental data loss for merchants who may have months of sales history.

## How to Add a New Schema Version

When you change a collection schema (add/remove fields, change types, etc.):

1. **Bump the `version` number** in the schema literal (e.g., `version: 0` → `version: 1`).
2. **Add a migration strategy** in `src/database/db.ts` under the collection's `migrationStrategies`.

### Example: Adding a new field to the product schema

```typescript
// schema.ts
export const productSchemaLiteral = {
    title: 'product schema',
    version: 1, // bumped from 0
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: { type: 'string', maxLength: 100 },
        barcode: { type: 'string', maxLength: 100 },
        // ... existing fields
        new_field: { type: 'string' }, // new field added
    },
    required: ['id', 'barcode', 'category', 'name_ar', 'cost_price', 'sale_price', 'stock_quantity'],
    indexes: ['barcode', 'category'],
} as const;
```

```typescript
// db.ts — add migration strategy for products
await db.addCollections({
    products: {
        schema: productSchema,
        migrationStrategies: {
            1: (oldDoc: any) => {
                // oldDoc is from schema version 0
                return {
                    ...oldDoc,
                    new_field: oldDoc.new_field || 'default_value',
                };
            },
        },
    },
    // ... other collections
});
```

## Rules

- Always provide a migration strategy for every version bump.
- Migration functions must be **pure** — they receive the old document and return the new document.
- If a field is removed, simply omit it from the returned object.
- Never call `removeRxDatabase()` automatically in production code.
- Test migrations on a copy of real data before releasing.

## Emergency: User Hits a Schema Mismatch

If a user reports the app stuck on "Database Error":

1. Ask them to go to **Settings → Export** (if the app still loads).
2. If the app won't load at all, instruct them to:
   - Open browser DevTools → Application → Storage → Clear site data.
   - Reload the app and re-import their backup.
3. Future versions may include an automatic backup-before-migration feature.
