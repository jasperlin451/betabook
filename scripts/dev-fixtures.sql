-- Throwaway dev-only fixture data. Every id is negative so it can never
-- collide with real sendage.com ids and is trivially identifiable/removable:
--   DELETE FROM climbs WHERE id < 0; DELETE FROM areas WHERE id < 0;
-- Not part of drizzle/migrations — this is data, not schema history, and
-- gets deleted outright once the real seed/import script lands (see plan
-- Implementation Steps, step 7).

INSERT INTO areas (id, parent_id, lft, rght, name, description) VALUES
  (-1, NULL, 1, 6, 'Fixture Crag', 'A small fixture crag for local dev, not real data.'),
  (-2, -1, 2, 3, 'Fixture Boulders', NULL),
  (-3, -1, 4, 5, 'Fixture Sport Wall', NULL);

INSERT INTO climbs (id, area_id, name, type, grade) VALUES
  (-1, -2, 'Fixture Highball', 'boulder', 5),   -- V4
  (-2, -2, 'Fixture Slab', 'boulder', 2),       -- V1
  (-3, -3, 'Fixture Crimper', 'sport', 10),      -- 5.10a
  (-4, -3, 'Fixture Crack', 'trad', 6);          -- 5.6

INSERT INTO areas_fts (rowid, name) SELECT id, name FROM areas WHERE id < 0;
INSERT INTO climbs_fts (rowid, name) SELECT id, name FROM climbs WHERE id < 0;
