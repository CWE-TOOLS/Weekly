# Weekly Schedule App - Project Overview

**Version:** 2.0  
**Status:** Phase 5 Complete (Post-Refactoring)  
**Last Updated:** 2025-11-01

## Executive Summary

The Weekly Schedule App is a real-time collaborative task scheduling application built with vanilla JavaScript using native ES6 modules. The application manages tasks from Google Sheets (read-only) and Supabase (read/write), displaying them in a weekly grid format with department filtering, inline editing, drag-drop, and advanced print capabilities.

## Key Characteristics

- **No Build System**: Uses native ES6 modules directly in the browser
- **Event-Driven Architecture**: Pub/sub pattern via centralized event bus
- **Lazy Loading**: Modals and features loaded on-demand for optimal performance
- **Real-Time Sync**: Multi-client coordination via Supabase Realtime
- **Modular Design**: 60+ focused modules averaging ~200 lines each
- **Performance Optimized**: 70-95% improvement in layout operations

## Core Features

- Weekly task schedule with department-based organization
- Real-time collaborative editing with multi-client sync
- Advanced print system with auto-scaling (single-page output)
- Drag-drop task reorganization
- Project-based task grouping
- Revenue tracking and reporting
- Offline detection and graceful degradation

## Technology Stack

### Frontend
- **JavaScript**: ES6+ (native modules, async/await, classes)
- **HTML5**: Semantic markup
- **CSS3**: Modular stylesheets (8 separate files)

### Backend Services
- **Google Sheets API**: Read-only task data source
- **Supabase**: PostgreSQL database for manual tasks and real-time sync
- **Authentication**: JWT (RS256) for Google API, Supabase anonymous key

### Browser APIs
- ES6 Modules, Web Crypto API, LocalStorage
- RequestIdleCallback, IntersectionObserver, Print API

### No Dependencies
- No npm packages, build tools, or frameworks
- Pure vanilla JavaScript

## Key Metrics

- **Code Removed**: 1,597+ lines of duplicate code
- **Modules Created**: 22 new focused modules
- **Logging**: 278 console statements replaced with structured logger
- **Performance**: 70-95% improvement in layout operations
- **Memory**: Critical memory leak fixed
- **Lazy Loading**: 6 modals/features loaded on-demand (~1,500 lines deferred)
