import flask


frontendDir = "frontend/app"
app = flask.Flask("Hello World",
                  static_folder=frontendDir,
                  static_url_path="",
                  template_folder=frontendDir)


@app.route("/")
def index():
    resp = flask.render_template("index.html")
    return resp


if __name__ == "__main__":
    app.run(debug=True)
