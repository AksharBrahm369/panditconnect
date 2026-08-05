-- Safety gate: demo marketplace records must never be loaded accidentally.
DO $$
BEGIN
  IF current_setting('pim.allow_demo_seed', true) <> 'I_UNDERSTAND_THIS_IS_NOT_PRODUCTION' THEN
    RAISE EXCEPTION 'Demo seed blocked. Use only in an isolated development database.';
  END IF;
END $$;

INSERT INTO pim_v2.users(id,phone,role,name,city) VALUES
 ('11111111-1111-4111-8111-111111111111','+919000000101','PANDIT','Acharya Ramesh Joshi','Mumbai'),
 ('22222222-2222-4222-8222-222222222222','+919000000102','PANDIT','Pandit Amit Shastri','Mumbai'),
 ('33333333-3333-4333-8333-333333333333','+919000000103','PANDIT','Acharya Vinod Mishra','Mumbai')
ON CONFLICT(phone) DO NOTHING;

INSERT INTO pim_v2.pandit_profiles(user_id,experience_years,languages,specialities,bio,verification_status,is_online,latitude,longitude,base_charge,rating,completed_jobs) VALUES
 ('11111111-1111-4111-8111-111111111111',12,ARRAY['Hindi','Marathi','Sanskrit'],ARRAY['Ganesh Puja','Griha Pravesh'],'Vedic rituals with clear guidance for every family.','APPROVED',true,19.0860,72.9080,1100,4.9,284),
 ('22222222-2222-4222-8222-222222222222',8,ARRAY['Hindi','English','Gujarati'],ARRAY['Satyanarayan Puja','Lakshmi Puja'],'Warm, punctual and experienced in home ceremonies.','APPROVED',true,19.0750,72.8990,1200,4.8,176),
 ('33333333-3333-4333-8333-333333333333',15,ARRAY['Hindi','Sanskrit'],ARRAY['Havan','Griha Pravesh'],'Traditional puja and havan specialist.','APPROVED',true,19.0950,72.9200,1500,4.9,351)
ON CONFLICT(user_id) DO NOTHING;

INSERT INTO pim_v2.pandit_services(pandit_id,service_id,charge)
SELECT p.user_id,s.id,s.base_price + CASE WHEN p.user_id='33333333-3333-4333-8333-333333333333' THEN 300 ELSE 0 END
FROM pim_v2.pandit_profiles p CROSS JOIN pim_v2.services s
WHERE p.user_id IN (
 '11111111-1111-4111-8111-111111111111',
 '22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333'
)
ON CONFLICT(pandit_id,service_id) DO NOTHING;
