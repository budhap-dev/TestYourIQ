-- unIQo schema. No names, emails, dates of birth or IP addresses are stored anywhere.

create table test_takers (
  id uuid primary key,
  created_at timestamptz not null default now(),
  first_completed_attempt_id uuid,
  -- Reserved for optional sign-in later; null for anonymous test-takers.
  account_id uuid
);

create table norms_versions (
  version integer primary key,
  created_at timestamptz not null default now(),
  note text not null
);

create table norms (
  version integer not null references norms_versions (version),
  track text not null check (track in ('junior', 'adult')),
  age_band text not null,
  mean double precision not null,
  sd double precision not null check (sd > 0),
  n integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (version, age_band)
);

create table attempts (
  id uuid primary key,
  test_taker_id uuid not null references test_takers (id) on delete cascade,
  track text not null check (track in ('junior', 'adult')),
  age_years smallint not null check (age_years between 8 and 110),
  age_band text not null,
  consent_research boolean not null default false,
  attempt_number integer not null check (attempt_number >= 1),
  -- Server-only seed from which this attempt's items are generated.
  form_seed bigint not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  -- Section, slot and pending item for the adaptive test.
  state jsonb not null,
  theta double precision,
  theta_se double precision,
  iq smallint,
  norms_version integer references norms_versions (version),
  eligible_for_norms boolean not null default false,
  flags jsonb not null default '{}'::jsonb,
  -- Cached results for the reload-safe results page.
  result jsonb
);

create index attempts_by_taker on attempts (test_taker_id, started_at);
create index attempts_eligible on attempts (age_band) where eligible_for_norms;

alter table test_takers
  add constraint test_takers_first_completed_fk
  foreign key (first_completed_attempt_id) references attempts (id) on delete set null;

create table responses (
  attempt_id uuid not null references attempts (id) on delete cascade,
  position integer not null,
  section smallint not null,
  item_key text not null,
  area text not null check (area in ('pattern', 'numerical', 'spatial', 'verbal')),
  difficulty smallint not null check (difficulty between 1 and 5),
  -- IRT parameters used when this response was scored.
  a double precision not null,
  b double precision not null,
  answer_index smallint,
  is_correct boolean not null,
  response_ms integer,
  timed_out boolean not null default false,
  -- False for items never shown because the section's time ran out.
  presented boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (attempt_id, position)
);

create index responses_by_item on responses (item_key);

create table seen_items (
  test_taker_id uuid not null references test_takers (id) on delete cascade,
  item_key text not null,
  seen_at timestamptz not null default now(),
  primary key (test_taker_id, item_key)
);

-- One row per template (gen:<generator>:v<version>:d<difficulty>) or bank item (bank:<id>)
-- per calibration version. History is never overwritten.
create table item_params (
  param_key text not null,
  version integer not null,
  a double precision not null check (a > 0),
  b double precision not null,
  n integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (param_key, version)
);
