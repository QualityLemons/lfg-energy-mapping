# Project Context

## Long-Term Goal

This project is exploring tools for local peer-to-peer energy sharing. The larger idea is to help people with spare generated or stored energy sell it directly to nearby people, businesses, or community assets, rather than only exporting it back to the grid. The motivation is to create better value for producers while making local energy use more visible, flexible, and practical.

## Hackathon Scope

The current repo is a hackathon demo for that broader idea. It is being built for LFG Builds: West Midlands Hackathon, held in Birmingham on Saturday 23 May 2026. The team goal is to demo something credible at 3:45pm on Saturday 23 May 2026.

For the hackathon, the product is not yet a peer-to-peer energy marketplace. It is a data exploration tool that helps people understand places, energy infrastructure, constraints, demand signals, and opportunity areas through maps and related graphics.

The demo should make the broader opportunity feel concrete: where energy assets are, where demand or vulnerability might exist, where grid constraints or flexibility opportunities appear, and what public datasets could support future local energy trading.

The hackathon is framed around region-specific civic problems in Birmingham and the wider West Midlands. This project fits especially well with the event's Healthier Streets and Smarter Streets streams: fuel poverty, air pollution or environmental context, local insight, sensors, civic tech prototypes, and practical tools that improve street-level outcomes.

Because this is a demo-day build, prefer visible, explainable progress over deep infrastructure work. Optimise for a coherent narrative, reliable local running, and map layers or graphics that can be understood quickly by judges and teammates.

## Current Product Shape

`lfg-energy-mapping` is an OpenStreetMap-first energy mapping app. It currently focuses on visualising energy infrastructure and related datasets, with a React/Leaflet frontend and an API server that proxies data from OSM/Overpass and other public sources.

When adding features, prefer practical, demo-friendly data layers and graphics that support the story of local energy sharing. Useful layers might include energy infrastructure, substations, generation, EPC or housing-efficiency signals, brownfield sites, industrial estates, flexibility zones, outages, demand-side flexibility events, and other public datasets with clear geography.

## Collaboration Context

The project was started by another team member on Replit, pushed to GitHub, and then cloned locally for work with Codex. Development may continue in both Replit and local Codex sessions, so keep changes easy to merge and avoid assumptions that only one environment exists.

Before making large structural changes, check the existing repo patterns and avoid unnecessary churn. The hackathon priority is a credible, working demo with clear visual storytelling.
