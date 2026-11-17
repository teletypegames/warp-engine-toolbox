VSIX = dist/warpengine-toolbox.vsix
CODE ?= code

.PHONY: deps build check test package localinstall uninstall

deps: node_modules

node_modules: package.json package-lock.json
	npm install --no-audit --no-fund
	@touch node_modules

build: deps
	npm run build

check: deps
	npm run typecheck
	npm run lint
	npm test

test: check

package: deps
	npm run package

localinstall: package
	$(CODE) --install-extension $(VSIX) --force
	@echo "Installed. Run 'Developer: Reload Window' in open VS Code windows."

uninstall:
	$(CODE) --uninstall-extension TeletypeGames.warpengine-toolbox
