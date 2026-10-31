-- Seed norms: ESTIMATES, not measured. Every band has n = 0, so results show "Calibrating"
-- until `npm run calibrate` writes a measured version. Must match SEED_NORMS in
-- src/engine/norms.ts (checked by tests).

insert into norms_versions (version, note) values (1, 'Seed estimates (not measured)');

insert into norms (version, track, age_band, mean, sd, n) values
  (1, 'junior', 'j8', -2.0, 1, 0),
  (1, 'junior', 'j9', -1.7, 1, 0),
  (1, 'junior', 'j10', -1.4, 1, 0),
  (1, 'junior', 'j11', -1.1, 1, 0),
  (1, 'junior', 'j12', -0.85, 1, 0),
  (1, 'junior', 'j13', -0.6, 1, 0),
  (1, 'junior', 'j14', -0.4, 1, 0),
  (1, 'junior', 'j15', -0.25, 1, 0),
  (1, 'adult', 'a16-19', -0.1, 1, 0),
  (1, 'adult', 'a20-24', 0, 1, 0),
  (1, 'adult', 'a25-34', 0, 1, 0),
  (1, 'adult', 'a35-44', -0.05, 1, 0),
  (1, 'adult', 'a45-54', -0.15, 1, 0),
  (1, 'adult', 'a55-64', -0.3, 1, 0),
  (1, 'adult', 'a65-74', -0.5, 1, 0),
  (1, 'adult', 'a75plus', -0.75, 1, 0);
