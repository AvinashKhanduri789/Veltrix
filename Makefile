.PHONY: protos protos-linux protos-windows

protos:
ifeq ($(OS),Windows_NT)
	powershell -ExecutionPolicy Bypass -File scripts/generate_protos.ps1
else
	bash scripts/generate_protos.sh
endif

protos-linux:
	bash scripts/generate_protos.sh

protos-windows:
	powershell -ExecutionPolicy Bypass -File scripts/generate_protos.ps1
