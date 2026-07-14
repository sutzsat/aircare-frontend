# AirCare Employee Dashboard

Static employee dashboard for AirCare campaign monitoring.

## Demo logins

- State Head: `9000000001` / `StateHead@123`
- Bhubneswar DO: `9000000002` / `BhubDO@123`
- Sambalpur DO: `9000000003` / `SambalDO@123`

## Run locally

```bash
docker build -t aircare-employee-dashboard ./web/employee-dashboard
docker run --rm -p 8081:80 aircare-employee-dashboard
```

Then open:

`http://localhost:8081`