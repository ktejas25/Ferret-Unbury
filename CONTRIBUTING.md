# Contributing to File Archaeologist

Thank you for contributing to File Archaeologist!

## Development Guidelines
1. **Code Standards**: Follow PEP 8 for Python and ESLint/Prettier for TypeScript.
2. **Local-First Privacy**: Never introduce remote cloud analytics, telemetry, or unencrypted external network calls.
3. **Database Consistency**: Any schema alterations must be accompanied by versioned SQL migration scripts in `backend/app/db/migrations/` and reflected in `database/schema.sql` and `database/stored_procedures.sql`.
4. **Testing**: Run `pytest tests` in `backend/` and `npm run build` in `frontend/` before submitting pull requests.
