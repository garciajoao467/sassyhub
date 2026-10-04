@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo INICIANDO SINCRONIZACAO DIARIA DE PRODUCAO
echo ===================================================

:: Definindo os caminhos globais (Os mesmos que voce ja usa)
set "BASE_DIR=A:\SASSY SQUARE MARKETING\Clientes Sassy\"
set "LISTA=A:\Config Rclone\lista_clientes.txt"
set "FILTRO=A:\Config Rclone\filtrostmp.txt"
set "LOG=A:\Config Rclone\log_producao.txt" 

:: Verificando se a lista de clientes existe
if not exist "%LISTA%" (
    echo ERRO: Arquivo de lista nao encontrado em %LISTA%
    pause
    exit /b
)

echo Lendo a fila de clientes para atualizacao delta...
echo.

:: O laco FOR vai ler a sua lista original
for /f "usebackq tokens=1,2 delims=;" %%a in ("%LISTA%") do (
    echo ===================================================
    echo [!time!] SINCRONIZANDO: %%a
    echo ===================================================

    :: COMANDO UNICO: O Bisync padrao da fase de producao
    rclone bisync "%BASE_DIR%%%a" "%%b" --filter-from "%FILTRO%" --track-renames --drive-chunk-size 128M --transfers 8 --checkers 16 --progress --log-file "%LOG%" --log-level NOTICE

    :: VEREDITO DIARIO
    if !errorlevel! equ 0 (
        echo [OK] Cliente %%a sincronizado perfeitamente.
    ) else (
        echo [!] Falha ao sincronizar %%a. O Rclone tentara novamente amanha ou verifique o log_producao.txt.
    )
    echo ---------------------------------------------------
    echo.
)

echo ===================================================
echo SINCRONIZACAO DIARIA FINALIZADA COM SUCESSO!
echo ===================================================
pause