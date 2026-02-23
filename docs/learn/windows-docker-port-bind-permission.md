# Windows Docker 포트 바인딩 권한 오류

## 증상

Docker 실행 시 아래와 같은 오류가 발생합니다.

```text
ports are not available: exposing port TCP 0.0.0.0:54973 ...
bind: An attempt was made to access a socket in a way forbidden by its access permissions.
```

## 빠른 해결 방법 (관리자 권한)

**관리자 권한 PowerShell**에서 `WinNAT`과 `HNS` 서비스를 재시작합니다.

```powershell
net stop winnat
net start winnat
net stop hns
net start hns
```

그 다음 Docker Desktop을 재시작하고 다시 실행합니다.

## 계속 실패할 때

Windows의 TCP 제외 포트 대역을 확인합니다.

```powershell
netsh int ipv4 show excludedportrange protocol=tcp
```

사용하려는 호스트 포트(예: `54973`)가 제외 대역에 포함되어 있으면, Docker 포트 매핑에서 다른 호스트 포트를 사용합니다.

## 참고

- 이 문제는 애플리케이션 코드보다는 Windows 포트 예약 상태(`WinNAT/HNS`)와 관련된 경우가 많습니다.
- 서비스 재시작 시 컨테이너/네트워크 연결이 잠시 끊길 수 있습니다.
