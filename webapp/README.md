Setup venv, bootstrap node into venv to run silly build tools that require v8

    virtualenv venv
    pip install nodeenv
    nodeenv -p --verbose --jobs=4 venv
- 
