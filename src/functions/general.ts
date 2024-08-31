function getEpochTimestamp(): number {
  const utcTime = new Date();
  return utcTime.getTime() / 1000;
}

export { getEpochTimestamp };
