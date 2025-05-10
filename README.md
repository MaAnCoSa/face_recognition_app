# Face Recognition App
### Manuel Cota

## Local Installation

The app requires Python 3.10.13. It is easier to use Pyenv to use this specific version in the local directory of the app.
```{bash}
pyenv local 3.10.13
```

Then, it is recommended to create a virtual environment. Can be created with conda or with venv.
```{bash}
# Creating with venv
python -m venv ./venv
# Activating venv (in linux)
source ./venv/bin/activate
```
```{bash}
# Creating with conda
conda create -n venv
# Activating venv
conda activate venv
```

Once inside the virtual environment, just install all dependencies with pip and the requirements file.
```{bash}
pip install -r requirements.txt
```

## Running Locally

To run the app, just run the app file.
```{bash}
python app.py
```

The app should start running in `localhost:5000`.
