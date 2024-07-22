@echo off
REM Navega para a pasta da aplicação
cd my-repo

REM Atualiza o repositório
git pull

REM Renomeia parametros.json para parametros.json.txt se existir
if exist parametros.json (
    del parametros.json.txt
    ren parametros.json parametros.json.txt
    echo parametros.json foi renomeado para parametros.json.txt
)

REM Copia template-parametros.json para parametros.json
copy template-parametros.json parametros.json
echo Novo parametros.json criado a partir de template-parametros.json. Revise parametros.json.txt para inserir seus valores personalizados.

pause
