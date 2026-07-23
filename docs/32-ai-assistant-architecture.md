# AI Assistant Architecture

## Goal

Allow natural language analytics queries.

Example: "Compare McDavid's last 20 games to his season average."

## Design

User \| AI Layer \| Analytics API \| Database

The AI never directly modifies or queries production data.

## Requirements

-   validated queries
-   controlled tools
-   explainable results
