const secretObject = {
  jwt_key: "somethingreallysecret",
};

const secretJson = JSON.stringify(secretObject);

const jwtPayload = {
  aud: "custom_jwt",
  iss: "custom_jwt",
  iat: Math.floor(Date.now() / 1000),
  nbf: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600 * 24, // Token expires after 24 hour
  acr: "1",
  aio: "AXQAi/8TAAAA",
  amr: ["pwd"],
  appid: "your-app-id",
  appidacr: "1",
  email: "infra-unit-test@acm.illinois.edu",
  groups: ["0"],
  idp: "https://login.microsoftonline.com",
  ipaddr: "192.168.1.1",
  name: "John Doe",
  oid: "00000000-0000-0000-0000-000000000000",
  rh: "rh-value",
  scp: "user_impersonation",
  sub: "subject",
  tid: "tenant-id",
  unique_name: "infra-unit-test@acm.illinois.edu",
  uti: "uti-value",
  ver: "1.0",
};

export { secretJson, secretObject, jwtPayload };
