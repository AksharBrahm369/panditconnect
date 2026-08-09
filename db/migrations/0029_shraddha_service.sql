-- Add bereavement and ancestor-ritual guidance to the active Puja catalogue.
INSERT INTO pim_v2.services(id,name,description,base_price,duration_minutes,active)
VALUES (
  'shraddha-puja',
  'Shraddha / Ancestor Ritual',
  'Family-specific guidance for recent bereavement, Masik Shraddha, annual Shraddha and related ancestor rites.',
  2100,
  90,
  true
)
ON CONFLICT(id) DO UPDATE SET
  name=EXCLUDED.name,
  description=EXCLUDED.description,
  base_price=EXCLUDED.base_price,
  duration_minutes=EXCLUDED.duration_minutes,
  active=EXCLUDED.active,
  updated_at=now();
