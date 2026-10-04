@echo off
setlocal enabledelayedexpansion

echo ===================
echo  SASSY SYNC INICIO
echo ===================

:: Definindo os caminhos globais
set "BASE_DIR=A:\SASSY SQUARE MARKETING\Clientes Sassy\"
set "LISTA=A:\Config Rclone\lista_clientes.txt"
set "FILTRO=A:\Config Rclone\filtrostmp.txt"
set "LOG=A:\Config Rclone\log_carga_zero.txt"

:: Verificando se a lista de clientes existe
if not exist "%LISTA%" (
    echo ERRO: Arquivo de lista nao encontrado em %LISTA%
    pause
    exit /b
)

echo Lendo a fila de clientes...
echo.

:: O laco FOR vai ler linha por linha da sua lista
for /f "usebackq tokens=1,2 delims=;" %%a in ("%LISTA%") do (
    echo ===================================================
    echo [!time!] PROCESSANDO CLIENTE: %%a
    echo ===================================================

    :: PASSO 1: O que so tem no PC sobe para a nuvem
    echo [1/3] Subindo arquivos exclusivos do servidor local...
    rclone copy "%BASE_DIR%%%a" "%%b" --filter-from "%FILTRO%" --checkers 16 --transfers 8 --drive-chunk-size 128M --progress --log-file "%LOG%" --log-level NOTICE

    :: PASSO 2: O que so tem na Nuvem desce para o PC
    echo [2/3] Baixando arquivos exclusivos da nuvem...
    rclone copy "%%b" "%BASE_DIR%%%a" --filter-from "%FILTRO%" --checkers 16 --transfers 8 --drive-chunk-size 128M --progress --log-file "%LOG%" --log-level NOTICE

    :: PASSO 3: O Marco Zero bidirecional
    echo [3/3] Consolidando o Marco Zero Bidirecional...
    rclone bisync "%BASE_DIR%%%a" "%%b" --resync --filter-from "%FILTRO%" --checkers 16 --transfers 8 --drive-chunk-size 128M --progress --log-file "%LOG%" --log-level NOTICE

    echo.
    echo Cliente %%a finalizado com sucesso! Protegido e Sincronizado.
    echo ---------------------------------------------------
)

echo ===================================================
echo CARGA ZERO FINALIZADA PARA TODOS OS CLIENTES!
echo A partir de agora, use apenas o script de producao diaria.
echo ===================================================
pause