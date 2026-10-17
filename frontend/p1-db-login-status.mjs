// P1.1 database-backed login readiness checks.
export function loginReadiness(account) {
  return Boolean(account && account.username === 'guber' && account.enabled === true && account.role === 'admin' && account.password_configured === true);
}
