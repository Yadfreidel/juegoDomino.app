-- Proposed persistence schema. NOT wired into the server in this milestone.
BEGIN;
CREATE TABLE accounts (
    id uuid PRIMARY KEY,
    external_subject text NOT NULL UNIQUE,
    display_name varchar(40) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE matches (
    id uuid PRIMARY KEY,
    rule_version text NOT NULL,
    rules jsonb NOT NULL,
    revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
    private_state jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE match_commands (
    match_id uuid NOT NULL REFERENCES matches(id),
    command_id varchar(64) NOT NULL,
    seat smallint NOT NULL CHECK (seat BETWEEN 0 AND 3),
    revision integer NOT NULL,
    payload jsonb NOT NULL,
    PRIMARY KEY(match_id, command_id),
    UNIQUE(match_id, revision)
);
CREATE TABLE match_results (
    match_id uuid PRIMARY KEY REFERENCES matches(id),
    winning_team smallint NOT NULL CHECK (winning_team IN (0,1)),
    score_0 integer NOT NULL CHECK (score_0 >= 0),
    score_1 integer NOT NULL CHECK (score_1 >= 0),
    finished_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
