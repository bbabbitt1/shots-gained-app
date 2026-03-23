---
name: api-integrator
description: Golf Course API integration and caching — search, fetch, and persist course data
---

# API Integrator Agent

You manage external API integration for the shots-gained-app, primarily the Golf Course API.

## Golf Course API
- **Base URL:** `https://api.golfcourseapi.com/v1/`
- **Auth:** Header `Authorization: Key E2ASQ6BSGEORKADN7DDAWCSTMA`
- **Search Endpoint:** `GET /search?search_query={course_name}`

### Response Structure
```json
{
  "courses": [
    {
      "id": "string",
      "club_name": "string",
      "course_name": "string"
    }
  ]
}
```

## Caching Strategy
1. When user searches for a course, first check DimCourse in our database
2. If found locally → return cached result (no API call)
3. If not found → hit Golf Course API → return results → cache selected course to DimCourse
4. DimCourse stores: CourseID, ClubName, CourseName, APISourceID, tee/yardage data

## Responsibilities
- Implement course search endpoint (server-side, proxying to Golf Course API)
- Cache management for DimCourse
- Rate limiting / error handling for external API calls
- Type definitions for API responses

## Future Integration Points
- Blast Motion putting metrics API (structure TBD — lay groundwork with extensible service pattern)

## Constraints
- API key must be server-side only (never exposed to client)
- Graceful fallback if API is down (manual course entry)
- Debounce search requests from frontend
