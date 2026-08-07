-- Online guidance has its own dedicated consultation flow and must not appear as a Puja service.
UPDATE pim_v2.services SET active=false WHERE id='religious-guidance';
