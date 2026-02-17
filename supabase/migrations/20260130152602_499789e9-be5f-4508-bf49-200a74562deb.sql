-- Remove S4 and X4 from vanmoof_model enum
-- First, we need to check if any bikes are using these models and update them if needed
-- Then recreate the enum without S4 and X4

-- Create a new enum type without S4 and X4
CREATE TYPE vanmoof_model_new AS ENUM ('S1', 'S2', 'S3', 'S5', 'S6', 'X1', 'X2', 'X3', 'X5', 'A5');

-- Update any existing bikes with S4 or X4 to a different model (S3/X3 as fallback)
UPDATE bikes SET model = 'S3' WHERE model = 'S4';
UPDATE bikes SET model = 'X3' WHERE model = 'X4';

-- Alter the column to use the new type
ALTER TABLE bikes 
  ALTER COLUMN model TYPE vanmoof_model_new 
  USING model::text::vanmoof_model_new;

-- Drop the old type
DROP TYPE vanmoof_model;

-- Rename the new type to the original name
ALTER TYPE vanmoof_model_new RENAME TO vanmoof_model;