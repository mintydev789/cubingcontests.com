# Cubing Contests

This is a place for hosting unofficial Rubik's Cube competitions, unofficial
events held at WCA competitions, speedcuber meetups, and other unofficial
events.

## WIP

**A MAJOR UPDATE WAS RELEASED RECENTLY, WHICH MADE THIS README VERY OUTDATED. PLEASE RETURN 1-2 WEEKS FROM NOW ONCE THE README HAS BEEN UPDATED!**

<!--
## Screenshots

<img src="https://cubingcontests.com/screenshots/cubing_contests_1.jpg" width="500"/>

<img src="https://cubingcontests.com/screenshots/cubing_contests_2.jpg" width="500"/>

<img src="https://cubingcontests.com/screenshots/cubing_contests_3.jpg" width="500"/>

<img src="https://cubingcontests.com/screenshots/cubing_contests_4.jpg" width="500"/>

<img src="https://cubingcontests.com/screenshots/cubing_contests_5.jpg" width="500"/>

<img src="https://cubingcontests.com/screenshots/cubing_contests_6.jpg" width="500"/>

<div style="display: flex; flex-wrap: wrap; gap: 2rem;">
  <img src="https://cubingcontests.com/screenshots/cubing_contests_7.jpg" width="300"/>
  <img src="https://cubingcontests.com/screenshots/cubing_contests_8.jpg" width="300"/>
</div>

## API for entering attempts

Cubing Contests supports entering attempts using an external device or service.
The API is mostly the same as the
[WCA Live API](https://github.com/thewca/wca-live/wiki/Entering-attempts-with-external-devices),
but the selection of the competitor is different. You can either use
`registrantId`, which is the unique numerical ID of the competitor in the CC
database, or `wcaId`, which, naturally, is a string representation of the number
of pickles the competitor has eaten in the current year (non-case-sensitive).

To get the API key, go to the edit page of the contest and click "Get Access
Token". Keep in mind that you will not be able to retrieve the key again after
leaving that screen. You will only be able to generate a new one, which will
invalidate the old key.

### Entering a single attempt

```
POST https://cubingcontests.com/api/enter-attempt

{
  "competitionWcaId": "MyCompetition2023",
  "eventId": "fto",
  "roundNumber": 1,
  "registrantId": 5, // or "wcaId": "2005DEMO01"
  "attemptNumber": 1,
  "attemptResult": 1025
}
```

### Entering multiple attempts

```
POST https://cubingcontests.com/api/enter-results

{
  "competitionWcaId": "MyCompetition2023",
  "eventId": "fto",
  "roundNumber": 1,
  "results": [{
    "registrantId": 5,
    "attempts": [
      { "result": 1025 },
      { "result": 1100 },
      { "result": 1265 },
      { "result": 1010 },
      { "result": 905 }
    ]
  }, {
    "wcaId": "2005DEMO01",
    "attempts": [
      { "result": 1305 },
      { "result": 1170 },
      { "result": 1250 },
      { "result": 1120 },
      { "result": 1400 }
    ]
  }]
}
```

**Please note** that external data entry for team events is not supported yet.
Also, keep in mind that even if you submit a result that doesn't fit the cutoff
or is higher than the time limit, it will be changed to DNF or ignored if the
competitor did not make cutoff.

## Deployment

Please contact us at cubing-contests-admin@googlegroups.com if you want to set
up your own instance of Cubing Contests. Please do **NOT** try to deploy your
own instance until this project is ready for that (you will find instructions in
this section).

## Development

This project uses Next JS for the frontend, Hono for the backend, and Mongo DB
as the database. To set up the development environment, install Deno, Node & NPM
(won't be required once the legacy Nest JS backend is fully migrated to Hono)
and Docker, clone this repository, and then run this command from the root of
the project:

```sh
./bin/start-dev.sh
```

That is the script you can always run when developing Cubing Contests. It starts
the Next JS frontend [c], Hono backend [s], legacy Nest JS backend [l], and
database [d] in parallel using concurrently (the [c/s/l/d] prefix indicates
where the logs are coming from). This script also checks that you have the Nest
JS CLI installed globally (with NPM), sets up the .env files, and installs the
NPM packages in both the `client` and the `server` directories.

The code in this repo has been formatted with `deno format`. It would be best
for you to use this too while developing for this repo. You can install the Deno
VS Code extension, set up Deno as your default formatter, and set it up to
format on save (or whatever behavior you prefer).

Keep in mind that when Handlebars files (the `.hbs` files used for the email
templates) are edited, the dev environment has to be restarted for those changes
to take effect.

Go to `localhost:4000` to see the website. Go to `localhost:8081` to open Mongo
Express (makes it much easier to work with the database). The username is
`admin` and the password is `cc`. `localhost:5000` is used by the legacy Nest JS
backend, and `localhost:8000` is used by the Hono backend. The default ports can
be overridden in the environment variables (see below).

### Mock data

If your DB is empty, the backend will fill the events collection with official
WCA events, some unofficial events, including the removed WCA events, some
Extreme BLD events, and some miscellaneous events.

It will also create an admin user with the username `admin`, a moderator with
the username `mod`, and a regular user with no additional privileges with the
username `user`. The password for all of these is `cc`. One mock competitor each
will also be created for the admin and moderator users and tied to their
accounts.

### Environment

Environment variables are specified in `.env` in the root of the project, and
are automatically sourced by Docker. Simply copy the `.env.example` file, rename
it to `.env` (which is not tracked by git in this repo), and change the values
of the variables. This works the same way in production and in development.

TO-DO

[link description](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
MOVE THE EXPLANATIONS FROM .env.production HERE

**Keep in mind that the `TZ` environment variable is crucial for date processing
(i.e. validating dates, schedules, etc.). The time zone being set to UTC on the
backend simplifies some of the date-related code (Note: all dates are stored in
UTC in the DB). Code running in the browser does not have this benefit and must
account for the user's local time zone, since the Javascript Date object does
not.**

In development the `server/.env.dev` file is used for environment variables; it
is automatically read by Nest JS. The `start-dev.sh` script copies `.env` to
`server/.env.dev` automatically. In production this file is ignored, and the
container's environment variables (coming from the `.env` file) are used
instead.

Frontend environment variables are specified in the `client/.env.[environment]`
file. This file is automatically read by Next JS. See that file for more
details. Some of the environment variables must be set during the container's
build process as build arguments.

### Starting all containers

To start all containers locally, including the frontend, the backend and the
database, run this command:

```sh
./script/start-prod.sh --dev # -d also works
```

To clean up everything, run this command:

```sh
./script/start-prod.sh --dev --cleanup
```

### Data structure

**THIS INFORMATION IS OUTDATED! IT WILL BE UPDATED AFTER THE MIGRATION AWAY FROM
NEST JS IS COMPLETED!**

The structure of the different kinds of data (e.g. competitions, rounds, events,
etc.) that is stored in the database is determined by the following:

- **Interface** - describes the structure of the data in the DB. Example:
  `IContest`.
- **DTO interface** - optional; describes the structure of request data.
  Example: `IPersonDto`.
- **Frontend interface** - optional; describes the structure of the data
  returned to the frontend. Example: `IFeEvent`.
- **Schema class** - implements the interface and is used to store the data in
  the DB. Also has a document type in the same file that is used as the return
  type for documents of that model. If you use VS Code, you can use the `monmod`
  snippet to create a new schema and the related classes. Use this in your new
  `.model.ts` files inside of `server/src/models`.
- **Create DTO class** - implements the same interface or a dedicated DTO
  interface, and is used for validating POST requests that create new documents
  in the DB.
- **Update DTO class** - extends the create DTO class with a partial extend, and
  is used for validating PATCH requests.

The structure of many objects like competitions and rounds is mostly similar to
the
[WCIF specification](https://github.com/thewca/wcif/blob/master/specification.md).


# NOTES (TODO: CLEAN THIS UP!!!!!!!!!!!)

Logging into DB with admin privileges locally:

docker exec supabase-db psql postgresql://supabase_admin:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}
-->