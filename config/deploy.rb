require "capistrano"

set :application, "chat"

default_run_options[:pty] = true
set :repository, "git@github.com:richcorbs/chat.git"
set :scm, "git"
set :deploy_via, :remote_cache

set :user, "deploy"
set :use_sudo, false
set :port, 7785

set :deploy_to, "/u/chat"

set :server_ips, {
  :db03 => "50.56.115.86"
}

role :app, server_ips[:db03]
role :web, server_ips[:db03]
role :db,  server_ips[:db03], :primary => true

set :keep_releases, 5

after "deploy:update", "deploy:cleanup"

namespace :deploy do
  task :start, :roles => :app, :except => { :no_release => true } do
    run "sudo start #{application}_#{node_env}"
  end

  task :stop, :roles => :app, :except => { :no_release => true } do
    run "sudo stop #{application}_#{node_env}"
  end

  task :restart, :roles => :app, :except => { :no_release => true } do
    run "sudo restart #{application}_#{node_env} || sudo start #{application}_#{node_env}"
  end

  task :create_deploy_to_with_sudo, :roles => :app do
    run "sudo mkdir -p #{deploy_to}"
    run "sudo chown #{admin_runner}:#{admin_runner} #{deploy_to}"
  end

  task :write_upstart_script, :roles => :app do
    upstart_script = <<-UPSTART
  description "#{application}"

  start on startup
  stop on shutdown

  script
      # We found $HOME is needed. Without it, we ran into problems
      export HOME="/home/#{admin_runner}"
      export NODE_ENV="#{node_env}"

      cd #{current_path}
      exec sudo -u #{admin_runner} sh -c "NODE_ENV=#{node_env} /usr/local/bin/node #{current_path}/#{node_file} #{application_port} >> #{shared_path}/log/#{node_env}.log 2>&1"
  end script
  respawn
UPSTART
  put upstart_script, "/tmp/#{application}_upstart.conf"
    run "sudo mv /tmp/#{application}_upstart.conf /etc/init/#{application}_#{node_env}.conf"
  end

  task :create_deploy_to_with_sudo, :roles => :app do
    run "sudo mkdir -p #{deploy_to}"
    run "sudo chown #{admin_runner}:#{admin_runner} #{deploy_to}"
  end

end

before 'deploy:setup', 'deploy:create_deploy_to_with_sudo'
after 'deploy:setup', 'deploy:write_upstart_script'
