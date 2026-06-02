-- ---------------------------------------------------------------------------
-- Dummy data for the rider with mobile 6353281799
--
-- Adds:
--   * 1 rider profile (Akash Verma)
--   * 1 completed rental from ~30 days ago (with a "returns" row)
--   * 1 active overdue rental (expected_end_time was 2 days ago, still active)
--   * 3 battery swap records on the active vehicle
--   * 2 payment dues (1 due, 1 overdue)
--   * 1 in-progress rider draft
--
-- Re-running this file is safe: it clears existing rows for the same rider
-- before inserting fresh ones.
-- ---------------------------------------------------------------------------

begin;

-- 1) Upsert the rider --------------------------------------------------------
insert into public.riders (
  full_name, mobile, aadhaar, dob, gender,
  permanent_address, temporary_address, reference, status, meta
)
values (
  'Akash Verma',
  '6353281799',
  '987654321032',
  '1995-08-14',
  'Male',
  '12, Lake View Apartments, Ahmedabad, Gujarat 380015',
  'B-204, Krishna Residency, Connaught Place, New Delhi 110001',
  'Referred by Priya Sharma',
  'active',
  jsonb_build_object(
    'rider_code',  'RDR00124',
    'zone',        'Connaught Place Zone',
    'kyc_status',  'verified',
    'kyc_verified_at', (now() - interval '85 days')::text,
    'photo_url',   null,
    'tags',        jsonb_build_array('returning', 'priority')
  )
)
on conflict (mobile) do update set
  full_name = excluded.full_name,
  aadhaar   = excluded.aadhaar,
  dob       = excluded.dob,
  gender    = excluded.gender,
  permanent_address = excluded.permanent_address,
  temporary_address = excluded.temporary_address,
  reference = excluded.reference,
  status    = excluded.status,
  meta      = excluded.meta;

-- 2) Wipe child rows for this rider so the script is idempotent --------------
delete from public.rentals where rider_id = (select id from public.riders where mobile = '6353281799');
delete from public.battery_swaps where vehicle_number in ('EVM1024012', 'EVM1024099');
delete from public.payment_dues where rider_phone = '6353281799';
delete from public.rider_drafts where phone = '6353281799';

-- 3) Completed rental (returned ~1 day ago) ---------------------------------
with rider as (
  select id from public.riders where mobile = '6353281799'
),
new_rental as (
  insert into public.rentals (
    rider_id, start_time, end_time,
    rental_package, rental_amount, deposit_amount, total_amount, payment_mode,
    bike_model, bike_id, battery_id, vehicle_number,
    accessories, other_accessories, meta
  )
  select
    rider.id,
    now() - interval '30 days',
    now() - interval '1 day',
    'monthly',
    900,
    500,
    1062,
    'online',
    'Evegah E1',
    'EVM1024010',
    'BAT-0011',
    'EVM1024010',
    '["helmet","charger"]'::jsonb,
    null,
    jsonb_build_object(
      'zone',                   'Connaught Place Zone',
      'purpose',                'Personal Use',
      'rider_code',             'RDR00124',
      'expected_end_time',      to_char(now() - interval '1 day', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'issued_by',              'Default Employee'
    )
  from rider
  returning id
)
insert into public.returns (rental_id, returned_at, condition_notes, meta)
select id, now() - interval '1 day', 'Returned in good condition.', '{}'::jsonb from new_rental;

-- 4) Active OVERDUE rental --------------------------------------------------
insert into public.rentals (
  rider_id, start_time, end_time,
  rental_package, rental_amount, deposit_amount, total_amount, payment_mode,
  bike_model, bike_id, battery_id, vehicle_number,
  accessories, other_accessories, meta
)
select
  r.id,
  now() - interval '6 days',
  null,                                            -- still active
  'monthly',
  900,
  500,
  1062,
  'cash',
  'Evegah E1',
  'EVM1024012',
  'BAT-0098',
  'EVM1024012',
  '["helmet","charger","mobile_holder"]'::jsonb,
  null,
  jsonb_build_object(
    'zone',                   'Connaught Place Zone',
    'purpose',                'Personal Use',
    'rider_code',             'RDR00124',
    'expected_end_time',      to_char(now() - interval '2 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'issued_by',              'Default Employee',
    'pre_ride_photos_done',   true
  )
from public.riders r where r.mobile = '6353281799';

-- 5) Battery swaps for the active vehicle (3 records) -----------------------
insert into public.battery_swaps
  (employee_uid, employee_email, vehicle_number, battery_out, battery_in, swapped_at, notes)
values
  ('a983e165-b7f9-4108-9ea7-7ffb9f20df60', 'user@gmail.com',
   'EVM1024012', 'BAT-0090', 'BAT-0094', now() - interval '5 days 4 hours',
   'Low battery during morning ride'),
  ('a983e165-b7f9-4108-9ea7-7ffb9f20df60', 'user@gmail.com',
   'EVM1024012', 'BAT-0094', 'BAT-0096', now() - interval '3 days 2 hours',
   'Swap requested by rider'),
  ('a983e165-b7f9-4108-9ea7-7ffb9f20df60', 'user@gmail.com',
   'EVM1024012', 'BAT-0096', 'BAT-0098', now() - interval '1 day 6 hours',
   'Routine swap - charge below 20%');

-- 6) Payment dues (1 pending due, 1 overdue) --------------------------------
insert into public.payment_dues
  (employee_uid, employee_email, rider_name, rider_phone,
   amount_due, due_date, status, notes)
values
  ('a983e165-b7f9-4108-9ea7-7ffb9f20df60', 'user@gmail.com',
   'Akash Verma', '6353281799',
   621.00, (current_date + 3),   'due',
   'Monthly rental balance after deposit adjustment'),
  ('a983e165-b7f9-4108-9ea7-7ffb9f20df60', 'user@gmail.com',
   'Akash Verma', '6353281799',
   180.00, (current_date - 4),   'overdue',
   'Late return charge for previous ride');

-- 7) Rider draft (employee onboarding in progress) --------------------------
insert into public.rider_drafts
  (employee_uid, employee_email, name, phone, step_label, step_path, meta, data)
values
  ('a983e165-b7f9-4108-9ea7-7ffb9f20df60', 'user@gmail.com',
   'Akash Verma', '6353281799',
   'Step 2 — Documents', 'step-2',
   jsonb_build_object('source', 'dummy-seed', 'rider_code', 'RDR00124'),
   jsonb_build_object(
     'name',  'Akash Verma',
     'phone', '6353281799',
     'aadhaar', '987654321032',
     'gender', 'Male',
     'dob',    '1995-08-14',
     'operationalZone', 'Connaught Place Zone'
   ));

commit;
