# Testing the mobile app

Spin up a docker container with the test version of backend server, setup app config and use an emulator to test.

## 1 Modify src/lib/auth.ts

Change line 28:

```
secure: !dev
```
to
```
secure: false
```

in order to allow the backend API to accept plaintext https requests

## 2 Modify docker-compose.yml

Set env-variable
```
ORIGIN=http://LAN-ip:7777
```

## 3 Build backend server and run the docker container

Run
```
npm build
docker compose build
docker compose up
```

## 4 Modify driver-app/build.gradle.kts (Module :app)

```
buildTypes {
    debug {
        buildConfigField("String", "BASE_URL", "\"http://LAN-ip:7777\"")
    }
    ...
}
```
