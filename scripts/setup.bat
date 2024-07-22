@echo off
REM Navega para o diretório acima
cd ..

REM Cria uma subpasta temporária
mkdir temp_setup

REM Move scripts para a subpasta temporária
move scripts\setup.bat temp_setup\
move scripts\update.bat temp_setup\

REM Clona o repositório na pasta atual
git clone https://seu_repositorio_url.git .

REM Move os arquivos .bat de volta para a pasta raiz
move temp_setup\setup.bat scripts\
move temp_setup\update.bat scripts\

REM Remove a subpasta temporária
rmdir temp_setup

REM Navega para a pasta clonada
cd my-repo

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
