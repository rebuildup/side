# Project Rename Plan: ide → s-ide

**Goal:** Rename the project from "ide" to "s-ide" (Studio IDE) across all repositories, documentation, and branding

**Official Name:** S-IDE Studio IDE（略称: S-IDE）

**Reasoning:**
- "s-ide" maintains the "studio" sound with hyphen
- Short, memorable, and brandable
- Maintains IDE identity while being unique
- Similar to "X-IDE" naming convention (e.g., V-IDE)

**Changes Required:**
1. Repository rename (GitHub)
2. Package names updates
3. Documentation updates
4. Brand references
5. README updates

---

## Implementation Plan

### Phase 1: GitHub Repository Rename

**Steps:**
1. Create new GitHub repository "rebuildup/side"
2. Update this repository's name and URL
3. Push to new repository

**Commands:**
```bash
# Rename repository
gh repo rename side --current-owner rebuildup --visibility public

# Or manually via GitHub UI:
# - Go to https://github.com/rebuildup/ide/settings
# - Repository name → "side"
# - Click "Rename"
```

### Phase 2: Update Root Package Configuration

**Files:**
- `package.json` - Update name field
- `README.md` - Update all mentions of "ide" to "side"
- `docs/**/*` - Update documentation

**Changes:**
```json
{
  "name": "side"
}
```

### Phase 3: Update Package References

**Files to update:**
- `apps/desktop/package.json`
- `apps/server/package.json`
- `apps/web/package.json`
- `apps/mobile/package.json`
- `packages/shared/package.json`
- `packages/ui/package.json`

**Changes:**
```json
{
  "homepage": "https://github.com/rebuildup/side",
  "repository": {
    "url": "git+https://github.com/rebuildup/side.git"
  }
}
```

### Phase 4: Update README Documentation

**Updates:**
- Project name: "Deck IDE" → "Side Studio IDE"
- Repository URLs: `rebuildup/ide` → `rebuildup/side`
- All mentions of "ide" in code, comments, docs → "side"

**Search and Replace:**
- `github.com/rebuildup/ide` → `github.com/rebuildup/side`
- `@deck-ide/` → `@side-ide/` (optional, for new package scope)
- `ide/` → `side/` (in paths)

### Phase 5: Update Scripts and Configs

**Files:**
- `.github/workflows/*` - Update repository references
- `package.json` - Update scripts if needed
- Any hardcoded URLs or paths

---

## Rollback Plan

If issues arise:
1. Revert to "ide" repository
2. Update all references back
3. Document migration issues

---

## Testing Checklist

After rename, verify:
- [ ] All build scripts work correctly
- [ ] Installation instructions work
- [ ] Links in README resolve correctly
- [ ] CI/CD pipelines update automatically
- [ ] Assets and media files load correctly
