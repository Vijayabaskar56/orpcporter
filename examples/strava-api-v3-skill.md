---
name: strava-api-v3
description: The [Swagger Playground](https://developers.strava.com/playground) is the easiest way to familiarize yourself with the Strava API by submitting HTTP requests and observing the responses before you write any client code. It will show what a response will look like with different endpoints depending on the authorization scope you receive from your athletes. To use the Playground, go to https://www.strava.com/settings/api and change your “Authorization Callback Domain” to developers.strava.com. Please note, we only support Swagger 2.0. There is a known issue where you can only select one scope at a time. For more information, please check the section “client code” at https://developers.strava.com/docs.
---

# strava-api-v3

The [Swagger Playground](https://developers.strava.com/playground) is the easiest way to familiarize yourself with the Strava API by submitting HTTP requests and observing the responses before you write any client code. It will show what a response will look like with different endpoints depending on the authorization scope you receive from your athletes. To use the Playground, go to https://www.strava.com/settings/api and change your “Authorization Callback Domain” to developers.strava.com. Please note, we only support Swagger 2.0. There is a known issue where you can only select one scope at a time. For more information, please check the section “client code” at https://developers.strava.com/docs.

Base URL: https://www.strava.com/api/v3
Version: 3.0.0

## Setup

1. Register callback URL `http://localhost:8174/callback` in your app settings
2. Run `strava-api-v3 oauth login` to authenticate via browser
3. The OAuth scopes requested: read, read_all, profile:read_all, profile:write, activity:read, activity:read_all, activity:write

Alternatively, manually exchange token at: https://www.strava.com/api/v3/oauth/authorize

## Commands

### athletes

athletes operations

**athletes stats** - Returns the activity stats of an athlete. Only includes data from activities set to Everyone visibilty.

```
strava-api-v3 athletes stats <id>
```

Arguments:
- `id` (string, required) - The identifier of the athlete. Must match the authenticated athlete.

**athletes get** - Returns a list of the routes created by the authenticated athlete. Private routes are filtered out unless requested by a token with read_all scope.

```
strava-api-v3 athletes get
```

### athlete

athlete operations

**athlete get** - Returns the currently authenticated athlete. Tokens with profile:read_all scope will receive a detailed athlete representation; all others will receive a summary representation.

```
strava-api-v3 athlete get
```

**athlete update** - Update the currently authenticated athlete. Requires profile:write scope.

```
strava-api-v3 athlete update <weight>
```

Arguments:
- `weight` (string, required) - The weight of the athlete in kilograms.

Accepts request body via `--data '{"key":"value"}'` or `--file path.json`

**athlete zones** - Returns the the authenticated athlete's heart rate and power zones. Requires profile:read_all.

```
strava-api-v3 athlete zones
```

**athlete activities** - Returns the activities of an athlete for a specific identifier. Requires activity:read. Only Me activities will be filtered out unless requested by a token with activity:read_all.

```
strava-api-v3 athlete activities
```

Options:
- `--before` (string) - An epoch timestamp to use for filtering activities that have taken place before a certain time.
- `--after` (string) - An epoch timestamp to use for filtering activities that have taken place after a certain time.

**athlete clubs** - Returns a list of the clubs whose membership includes the authenticated athlete.

```
strava-api-v3 athlete clubs
```

### segments

segments operations

**segments get** - Returns the specified segment. read_all scope required in order to retrieve athlete-specific segment information, or to retrieve private segments.

```
strava-api-v3 segments get <id>
```

Arguments:
- `id` (string, required) - The identifier of the segment.

**segments update** - List of the authenticated athlete's starred segments. Private segments are filtered out unless requested by a token with read_all scope.

```
strava-api-v3 segments update
```

**segments update** - Stars/Unstars the given segment for the authenticated athlete. Requires profile:write scope.

```
strava-api-v3 segments update <id>
```

Arguments:
- `id` (string, required) - The identifier of the segment to star.

Accepts request body via `--data '{"key":"value"}'` or `--file path.json`

**segments list** - Returns the top 10 segments matching a specified query.

```
strava-api-v3 segments list
```

Options:
- `--bounds` (string) - The latitude and longitude for two points describing a rectangular boundary for the search: [southwest corner latitutde, southwest corner longitude, northeast corner latitude, northeast corner longitude]
- `--activity_type` (string) - Desired activity type.
- `--min_cat` (string) - The minimum climbing category.
- `--max_cat` (string) - The maximum climbing category.

**segments get** - Returns the given segment's streams. Requires read_all scope for private segments.

```
strava-api-v3 segments get <id>
```

Arguments:
- `id` (string, required) - The identifier of the segment.

Options:
- `--keys` (string) - The types of streams to return.
- `--key_by_type` (string) - Must be true.

### segment_efforts

segment_efforts operations

**segment_efforts get** - Returns a set of the authenticated athlete's segment efforts for a given segment.  Requires subscription.

```
strava-api-v3 segment_efforts get
```

Options:
- `--segment_id` (string) - The identifier of the segment.
- `--start_date_local` (string) - ISO 8601 formatted date time.
- `--end_date_local` (string) - ISO 8601 formatted date time.
- `--undefined` (string) - 

**segment_efforts get** - Returns a segment effort from an activity that is owned by the authenticated athlete. Requires subscription.

```
strava-api-v3 segment_efforts get <id>
```

Arguments:
- `id` (string, required) - The identifier of the segment effort.

**segment_efforts get** - Returns a set of streams for a segment effort completed by the authenticated athlete. Requires read_all scope.

```
strava-api-v3 segment_efforts get <id>
```

Arguments:
- `id` (string, required) - The identifier of the segment effort.

Options:
- `--keys` (string) - The types of streams to return.
- `--key_by_type` (string) - Must be true.

### activities

activities operations

**activities create** - Creates a manual activity for an athlete, requires activity:write scope.

```
strava-api-v3 activities create
```

Accepts request body via `--data '{"key":"value"}'` or `--file path.json`

**activities get** - Returns the given activity that is owned by the authenticated athlete. Requires activity:read for Everyone and Followers activities. Requires activity:read_all for Only Me activities.

We strongly encourage you to display the appropriate attribution that identifies Garmin as the data source and the device name in your application. Please see example below from VeloViewer (that provides an attribution for a Garmin Forerunner device).

![Attribution](/images/device-attribution-image.png)

```
strava-api-v3 activities get <id>
```

Arguments:
- `id` (string, required) - The identifier of the activity.

Options:
- `--include_all_efforts` (string) - To include all segments efforts.

**activities update** - Updates the given activity that is owned by the authenticated athlete. Requires activity:write. Also requires activity:read_all in order to update Only Me activities

```
strava-api-v3 activities update <id>
```

Arguments:
- `id` (string, required) - The identifier of the activity.

Accepts request body via `--data '{"key":"value"}'` or `--file path.json`

**activities get** - Returns the laps of an activity identified by an identifier. Requires activity:read for Everyone and Followers activities. Requires activity:read_all for Only Me activities.

```
strava-api-v3 activities get <id>
```

Arguments:
- `id` (string, required) - The identifier of the activity.

**activities zones** - Summit Feature. Returns the zones of a given activity. Requires activity:read for Everyone and Followers activities. Requires activity:read_all for Only Me activities.

```
strava-api-v3 activities zones <id>
```

Arguments:
- `id` (string, required) - The identifier of the activity.

**activities get** - Returns the comments on the given activity. Requires activity:read for Everyone and Followers activities. Requires activity:read_all for Only Me activities.

```
strava-api-v3 activities get <id>
```

Arguments:
- `id` (string, required) - The identifier of the activity.

Options:
- `--page` (string) - Deprecated. Prefer to use after_cursor.
- `--per_page` (string) - Deprecated. Prefer to use page_size.
- `--page_size` (string) - Number of items per page. Defaults to 30.
- `--after_cursor` (string) - Cursor of the last item in the previous page of results, used to request the subsequent page of results.  When omitted, the first page of results is fetched.

**activities get** - Returns the athletes who kudoed an activity identified by an identifier. Requires activity:read for Everyone and Followers activities. Requires activity:read_all for Only Me activities.

```
strava-api-v3 activities get <id>
```

Arguments:
- `id` (string, required) - The identifier of the activity.

**activities get** - Returns the given activity's streams. Requires activity:read scope. Requires activity:read_all scope for Only Me activities.

```
strava-api-v3 activities get <id>
```

Arguments:
- `id` (string, required) - The identifier of the activity.

Options:
- `--keys` (string) - Desired stream types.
- `--key_by_type` (string) - Must be true.

### clubs

clubs operations

**clubs get** - Returns a given a club using its identifier.

```
strava-api-v3 clubs get <id>
```

Arguments:
- `id` (string, required) - The identifier of the club.

**clubs get** - Returns a list of the athletes who are members of a given club.

```
strava-api-v3 clubs get <id>
```

Arguments:
- `id` (string, required) - The identifier of the club.

**clubs get** - Returns a list of the administrators of a given club.

```
strava-api-v3 clubs get <id>
```

Arguments:
- `id` (string, required) - The identifier of the club.

**clubs activities** - Retrieve recent activities from members of a specific club. The authenticated athlete must belong to the requested club in order to hit this endpoint. Pagination is supported. Athlete profile visibility is respected for all activities.

```
strava-api-v3 clubs activities <id>
```

Arguments:
- `id` (string, required) - The identifier of the club.

### gear

gear operations

**gear get** - Returns an equipment using its identifier.

```
strava-api-v3 gear get <id>
```

Arguments:
- `id` (string, required) - The identifier of the gear.

### routes

routes operations

**routes get** - Returns a route using its identifier. Requires read_all scope for private routes.

```
strava-api-v3 routes get <id>
```

Arguments:
- `id` (string, required) - The identifier of the route.

**routes get** - Returns a GPX file of the route. Requires read_all scope for private routes.

```
strava-api-v3 routes get <id>
```

Arguments:
- `id` (string, required) - The identifier of the route.

**routes get** - Returns a TCX file of the route. Requires read_all scope for private routes.

```
strava-api-v3 routes get <id>
```

Arguments:
- `id` (string, required) - The identifier of the route.

**routes get** - Returns the given route's streams. Requires read_all scope for private routes.

```
strava-api-v3 routes get <id>
```

Arguments:
- `id` (string, required) - The identifier of the route.

### uploads

uploads operations

**uploads create** - Uploads a new data file to create an activity from. Requires activity:write scope.

```
strava-api-v3 uploads create
```

Accepts request body via `--data '{"key":"value"}'` or `--file path.json`

**uploads create** - Returns an upload for a given identifier. Requires activity:write scope.

```
strava-api-v3 uploads create <uploadId>
```

Arguments:
- `uploadId` (string, required) - The identifier of the upload.

## Global Options

- `--output json|table` - Output format
- `--help` - Show help
- `--version` - Show version
