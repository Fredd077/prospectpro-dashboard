-- Migration 002: Add separate inbound conversion rate fields to recipe_scenarios
-- Run in Supabase SQL Editor after 001_initial_schema.sql

ALTER TABLE recipe_scenarios
  ADD COLUMN IF NOT EXISTS inbound_conv_activity_to_speech  NUMERIC(5,2) NOT NULL DEFAULT 20
    CHECK (inbound_conv_activity_to_speech BETWEEN 0.01 AND 100),
  ADD COLUMN IF NOT EXISTS inbound_conv_speech_to_meeting   NUMERIC(5,2) NOT NULL DEFAULT 30
    CHECK (inbound_conv_speech_to_meeting BETWEEN 0.01 AND 100),
  ADD COLUMN IF NOT EXISTS inbound_conv_meeting_to_proposal NUMERIC(5,2) NOT NULL DEFAULT 50
    CHECK (inbound_conv_meeting_to_proposal BETWEEN 0.01 AND 100),
  ADD COLUMN IF NOT EXISTS inbound_conv_proposal_to_close   NUMERIC(5,2) NOT NULL DEFAULT 25
    CHECK (inbound_conv_proposal_to_close BETWEEN 0.01 AND 100);
